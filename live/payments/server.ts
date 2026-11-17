// Synthetic demo code for Nexus Intelligence. Not a real system.

import { columnQuery, formatBuilderLog } from "../../risk-feature-builder/src/build-features.ts";
import { clockParts } from "../lib/clock.ts";
import { FEATURE_LIMIT, featureCount, fetchFaults, nex28Phase, type FaultState } from "../lib/faults.ts";
import { listen, readBody, sendJson } from "../lib/http.ts";
import { insertPayment } from "../lib/ledger.ts";
import { emitLog, emitMetric } from "../lib/telemetry.ts";

const port = Number(process.env.PORT ?? 4413);
const observability = process.env.OBSERVABILITY_URL ?? "http://127.0.0.1:4400";
const query = columnQuery();
let faults: FaultState | null = null;
let generation = 7730;
let lastPhase: "failing" | "healthy" | null = null;
const nodes = ["wh-1", "wh-2", "wh-3", "wh-4", "wh-5", "wh-6"];
let nodeIndex = 0;

function sizeKb(features: number): number {
  return features > FEATURE_LIMIT ? 79.3 : 38.4;
}

function fileBytes(features: number): number {
  return features > FEATURE_LIMIT ? 79_312 : 38_402;
}

function emitBuilder(features: number): void {
  const now = new Date();
  const clock = clockParts(now);
  const node = nodes[nodeIndex % nodes.length];
  nodeIndex += 1;
  generation += 1;
  emitLog({
    timestamp: clock.iso,
    service: "risk-feature-builder",
    host: node,
    level: "INFO",
    line: formatBuilderLog(clock.lineTimeSeconds, generation, node, query, features, fileBytes(features)),
  });
}

function emitLoaded(features: number): void {
  const clock = clockParts(new Date());
  const kb = sizeKb(features).toFixed(1);
  emitLog({
    timestamp: clock.iso,
    service: "payments-gateway",
    level: "INFO",
    line: `${clock.lineTime} INFO  risk-scoring loaded feature file gen=${generation} features=${features} size=${kb}KB`,
  });
}

function emitPanic(features: number, traceId: string, orderId: string): void {
  const first = new Date();
  const second = new Date(first.getTime() + 1);
  const panicClock = clockParts(first);
  const httpClock = clockParts(second);
  const shared = {
    service: "payments-gateway",
    level: "ERROR" as const,
    scenario: "NEX-28",
    traceId,
    orderId,
    httpStatus: 500,
    serviceVersion: "3.41.0",
  };
  emitLog({
    ...shared,
    timestamp: panicClock.iso,
    line: `${panicClock.lineTime} ERROR risk-scoring thread=loader-2 PANIC: feature count ${features} exceeds preallocated limit ${FEATURE_LIMIT} (FeatureTable::load) - called unwrap() on Err(TooManyFeatures)`,
  });
  emitLog({
    ...shared,
    timestamp: httpClock.iso,
    line: `${httpClock.lineTime} ERROR http 500 POST /v1/authorizations trace_id=${traceId} trace=risk.score -> panic`,
  });
}

async function refresh(): Promise<void> {
  try {
    faults = await fetchFaults(observability);
    const phase = nex28Phase(faults["NEX-28"]);
    if (faults["NEX-28"].active && phase !== lastPhase) {
      const features = featureCount(faults["NEX-28"]);
      emitBuilder(features);
      if (phase === "healthy") {
        emitLoaded(features);
      }
      lastPhase = phase;
    }
    if (!faults["NEX-28"].active) {
      lastPhase = null;
    }
  } catch {
    // Observatory comes up first; keep the last snapshot.
  }
}

setInterval(() => {
  void refresh();
}, 500);
void refresh();

listen(port, async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "payments-gateway" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/authorizations") {
    const started = Date.now();
    const body = JSON.parse(await readBody(req)) as {
      traceId?: string;
      idempotencyKey?: string;
      orderId?: string;
      amountMinor?: number;
    };
    const traceId = body.traceId ?? "trace";
    const fault = faults?.["NEX-28"];
    const features = fault ? featureCount(fault) : 189;
    const over = features > FEATURE_LIMIT;
    const amount = Number(body.amountMinor ?? 0);
    const orderId = body.orderId ?? "unknown";
    const idempotencyKey = body.idempotencyKey ?? null;
    const paymentId = `pay-${orderId}-${(idempotencyKey ?? "none").slice(-12)}`;
    if (over) {
      emitPanic(features, traceId, orderId);
      await insertPayment({
        paymentId,
        orderId,
        chargeId: `ch-${paymentId}`,
        amountCents: amount,
        status: "failed",
        provider: "risk-scoring",
        idempotencyKey,
      });
    } else {
      await insertPayment({
        paymentId,
        orderId,
        chargeId: `ch-${paymentId}`,
        amountCents: amount,
        status: "captured",
        provider: "card",
        idempotencyKey,
      });
    }
    const latencyMs = Date.now() - started;
    emitMetric({
      timestamp: new Date().toISOString(),
      service: "payments-gateway",
      ok: !over,
      latencyMs,
    });
    if (over) {
      sendJson(res, 500, { status: "panic", traceId, features, limit: FEATURE_LIMIT });
      return;
    }
    sendJson(res, 200, {
      status: "approved",
      traceId,
      idempotencyKey: body.idempotencyKey ?? null,
      orderId: body.orderId ?? null,
      features,
    });
    return;
  }
  sendJson(res, 404, { error: "not found" });
});
