// Synthetic demo code for Nexus Intelligence. Not a real system.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { emptyFaults, featureCount, nex28Phase, type FaultState, type FaultSlice } from "../lib/faults.ts";
import { ansibleRecap, fleetBuildInfo, type HostBuild } from "../lib/fleet.ts";
import { readBody, sendJson } from "../lib/http.ts";
import { enqueueLog, ensureIndexTemplate, shipStats, type ShipLog } from "./ship-logs.ts";

const publicPort = Number(process.env.PORT ?? 4400);
const ingestPort = Number(process.env.INGEST_PORT ?? 4490);

interface LogRecord {
  timestamp: string;
  service: string;
  host?: string;
  level: string;
  line: string;
}

interface MetricRecord {
  timestamp: string;
  service: string;
  ok: boolean;
  latencyMs: number;
  orderId?: string;
  submissions?: number;
}

interface TraceRecord {
  traceId: string;
  root: string;
  status: "OK" | "ERROR";
  durationMs: number;
  startedAt: string;
  spans: { name: string; service: string; durationMs: number; status: "OK" | "ERROR" }[];
}

interface DeployRecord {
  id: string;
  service: string;
  status: string;
  startedAt: string;
  ansible: ReturnType<typeof ansibleRecap>;
  hosts: HostBuild[];
}

const faults: FaultState = emptyFaults();
const logs: LogRecord[] = [];
const metrics: MetricRecord[] = [];
const traces: TraceRecord[] = [];
const deploys: DeployRecord[] = [];
let buildInfo: HostBuild[] = fleetBuildInfo(false);

const KNOWN_SERVICES = [
  "storefront-web",
  "cart",
  "pricing-service",
  "checkout",
  "payments-gateway",
  "risk-feature-builder",
  "order-service",
];

function pushCap<T>(list: T[], item: T, cap: number): void {
  list.push(item);
  if (list.length > cap) {
    list.splice(0, list.length - cap);
  }
}

function scenariosBody() {
  const now = Date.now();
  const phase = nex28Phase(faults["NEX-28"], now);
  return {
    generatedAt: new Date().toISOString(),
    scenarios: [
      {
        id: "NEX-32",
        name: "B2B duplicate reprice",
        summary:
          "or-router-07 stays on order-service 5.5.3. ENABLE_BULK_REPRICE runs BulkRepricer, which re-submits with a new idempotency key. Ansible recap is SUCCESS with unreachable=1.",
        active: faults["NEX-32"].active,
      },
      {
        id: "NEX-28",
        name: "Risk feature file over limit",
        summary:
          "The feature builder's unscoped column query returns 412 features after analytics_r0 is visible. payments-gateway panics above the preallocated limit of 200. The file alternates on a 5 minute cycle (failing for the first 2.5 minutes).",
        active: faults["NEX-28"].active,
        phase,
        features: featureCount(faults["NEX-28"], now),
        limit: 200,
        periodMs: faults["NEX-28"].periodMs,
        failMs: faults["NEX-28"].failMs,
        activatedAt: faults["NEX-28"].activatedAt,
      },
      {
        id: "NEX-30",
        name: "inventory.svc DNS empty",
        summary:
          "Checkout cannot resolve inventory.svc.orbit.internal and maps the DNS failure to OUT_OF_STOCK.",
        active: faults["NEX-30"].active,
      },
    ],
  };
}

function parseSince(raw: string | null): { ok: true; value: number | null } | { ok: false } {
  if (!raw) {
    return { ok: true, value: null };
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return { ok: false };
  }
  return { ok: true, value: ms };
}

function limitOf(raw: string | null, fallback: number, max: number): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(max, Math.floor(parsed));
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function serviceMetrics(service: string, sinceMs: number | null) {
  const rows = metrics.filter((row) => {
    if (row.service !== service) {
      return false;
    }
    if (sinceMs == null) {
      return true;
    }
    return Date.parse(row.timestamp) >= sinceMs;
  });
  const latencies = rows.map((row) => row.latencyMs);
  const errors = rows.filter((row) => !row.ok).length;
  const now = Date.now();
  const first = rows.length > 0 ? Date.parse(rows[0].timestamp) : now;
  const windowStart = sinceMs ?? first;
  const seconds = Math.max(1, (now - windowStart) / 1000);
  const byOrder = new Map<string, number>();
  for (const row of rows) {
    if (!row.orderId || row.submissions == null) {
      continue;
    }
    byOrder.set(row.orderId, Math.max(byOrder.get(row.orderId) ?? 0, row.submissions));
  }
  let duplicateOrders = 0;
  let duplicateSubmissions = 0;
  for (const submissions of byOrder.values()) {
    if (submissions > 1) {
      duplicateOrders += 1;
      duplicateSubmissions += submissions - 1;
    }
  }
  return {
    service,
    requests: rows.length,
    errors,
    requestRatePerSec: Number((rows.length / seconds).toFixed(4)),
    errorRate: rows.length === 0 ? 0 : Number((errors / rows.length).toFixed(4)),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
    orders:
      service === "order-service"
        ? { placed: byOrder.size, duplicateOrders, duplicateSubmissions }
        : null,
  };
}

function applyFault(id: string, active: boolean): boolean {
  if (id !== "NEX-32" && id !== "NEX-28" && id !== "NEX-30") {
    return false;
  }
  const slice: FaultSlice = faults[id];
  slice.active = active;
  slice.activatedAt = active ? new Date().toISOString() : null;
  return true;
}

async function handlePublic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "content-type" });
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/health") {
    const body: { status: string; service: string; time: string; opensearch?: ReturnType<typeof shipStats> } = {
      status: "ok",
      service: "orbit-observability",
      time: new Date().toISOString(),
    };
    if (process.env.ORBIT_OPENSEARCH_URL) {
      body.opensearch = shipStats();
    }
    sendJson(res, 200, body);
    return;
  }
  if (req.method === "GET" && url.pathname === "/scenarios") {
    sendJson(res, 200, scenariosBody());
    return;
  }
  if (req.method === "GET" && url.pathname === "/control/state") {
    sendJson(res, 200, faults);
    return;
  }
  if (req.method === "POST" && url.pathname === "/control/faults") {
    const payload = JSON.parse(await readBody(req)) as { id?: string; active?: boolean };
    if (!payload.id || typeof payload.active !== "boolean" || !applyFault(payload.id, payload.active)) {
      sendJson(res, 400, { error: "unknown scenario" });
      return;
    }
    sendJson(res, 200, scenariosBody());
    return;
  }
  if (req.method === "POST" && url.pathname === "/control/heal") {
    applyFault("NEX-32", false);
    applyFault("NEX-28", false);
    applyFault("NEX-30", false);
    sendJson(res, 200, scenariosBody());
    return;
  }
  if (req.method === "GET" && url.pathname === "/logs") {
    const since = parseSince(url.searchParams.get("since"));
    if (!since.ok) {
      sendJson(res, 400, { error: "invalid since" });
      return;
    }
    const service = url.searchParams.get("service");
    const host = url.searchParams.get("host");
    const limit = limitOf(url.searchParams.get("limit"), 100, 1000);
    const filtered = logs.filter((row) => {
      if (service && row.service !== service) {
        return false;
      }
      if (host && row.host !== host) {
        return false;
      }
      if (since.value != null && Date.parse(row.timestamp) < since.value) {
        return false;
      }
      return true;
    });
    sendJson(res, 200, { generatedAt: new Date().toISOString(), logs: filtered.slice(-limit) });
    return;
  }
  if (req.method === "GET" && url.pathname === "/metrics") {
    const since = parseSince(url.searchParams.get("since"));
    if (!since.ok) {
      sendJson(res, 400, { error: "invalid since" });
      return;
    }
    const service = url.searchParams.get("service");
    const names = service ? [service] : KNOWN_SERVICES;
    const services = names.map((name) => serviceMetrics(name, since.value));
    sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      since: url.searchParams.get("since"),
      services,
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/deploys") {
    sendJson(res, 200, { generatedAt: new Date().toISOString(), buildInfo, deploys });
    return;
  }
  if (req.method === "GET" && url.pathname === "/traces") {
    const limit = limitOf(url.searchParams.get("limit"), 50, 200);
    sendJson(res, 200, { generatedAt: new Date().toISOString(), traces: traces.slice(-limit) });
    return;
  }
  sendJson(res, 404, { error: "not found" });
}

async function handleIngest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method !== "POST") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const payload = JSON.parse(await readBody(req) || "{}") as Record<string, unknown>;
  if (url.pathname === "/ingest/log") {
    const record = {
      timestamp: String(payload.timestamp ?? ""),
      service: String(payload.service ?? ""),
      level: String(payload.level ?? ""),
      line: String(payload.line ?? ""),
      ...(payload.host ? { host: String(payload.host) } : {}),
    };
    pushCap(logs, record, 5000);
    const ship: ShipLog = {
      timestamp: record.timestamp,
      service: record.service,
      level: record.level,
      line: record.line,
      host: record.host,
      traceId: typeof payload.traceId === "string" ? payload.traceId : undefined,
      spanId: typeof payload.spanId === "string" ? payload.spanId : undefined,
      orderId: typeof payload.orderId === "string" ? payload.orderId : undefined,
      cartId: typeof payload.cartId === "string" ? payload.cartId : undefined,
      tenantId: typeof payload.tenantId === "string" ? payload.tenantId : undefined,
      routerId: typeof payload.routerId === "string" ? payload.routerId : undefined,
      serviceVersion: typeof payload.serviceVersion === "string" ? payload.serviceVersion : undefined,
      httpStatus: typeof payload.httpStatus === "number" ? payload.httpStatus : undefined,
      scenario: typeof payload.scenario === "string" ? payload.scenario : undefined,
    };
    enqueueLog(ship);
  } else if (url.pathname === "/ingest/metric") {
    pushCap(metrics, payload as unknown as MetricRecord, 8000);
  } else if (url.pathname === "/ingest/trace") {
    pushCap(traces, payload as unknown as TraceRecord, 2000);
  } else if (url.pathname === "/ingest/deploy") {
    const deploy = payload as unknown as DeployRecord;
    const index = deploys.findIndex((row) => row.id === deploy.id);
    if (index >= 0) {
      deploys[index] = deploy;
    } else {
      deploys.push(deploy);
    }
  } else if (url.pathname === "/ingest/build-info") {
    buildInfo = (payload.hosts as HostBuild[]) ?? buildInfo;
  } else {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  sendJson(res, 202, { status: "accepted" });
}

function serve(port: number, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): void {
  createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "error";
      if (!res.headersSent) {
        sendJson(res, 500, { error: message });
      }
    });
  }).listen(port, "0.0.0.0");
}

serve(publicPort, handlePublic);
serve(ingestPort, handleIngest);
void ensureIndexTemplate().catch(() => undefined);
