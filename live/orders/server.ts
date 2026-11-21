// Synthetic demo code for Nexus Intelligence. Not a real system.

import { BulkRepricer, type Order } from "../../order-service/src/bulk-repricer.ts";
import { ContractPricing } from "../../order-service/src/contract-pricing.ts";
import { clockParts } from "../lib/clock.ts";
import { fetchFaults, type FaultState } from "../lib/faults.ts";
import { ansibleRecap, fleetBuildInfo, MISSED_ROUTER, ORDER_ROUTERS } from "../lib/fleet.ts";
import { listen, readBody, sendJson } from "../lib/http.ts";
import { allocateOrderId, insertOrder, listOrders, markOrderRunStarted, type LedgerItem } from "../lib/ledger.ts";
import { attemptOrderId } from "../lib/order-ids.ts";
import { emitBuildInfo, emitDeploy, emitLog, emitMetric } from "../lib/telemetry.ts";

const port = Number(process.env.PORT ?? 4414);
const observability = process.env.OBSERVABILITY_URL ?? "http://127.0.0.1:4400";
const paymentsUrl = process.env.PAYMENTS_URL ?? "http://127.0.0.1:4413";
const bulkAttempts = Number(process.env.ORBIT_BULK_ATTEMPTS ?? 4);

let faults: FaultState | null = null;
let sawBreak = false;
let publishedNex32: boolean | null = null;
let cursor = 0;
let lastPublish = 0;

function deployId(nex32: boolean): string {
  if (nex32) {
    return "dpl-order-77310";
  }
  return sawBreak ? "dpl-order-heal" : "dpl-order-baseline";
}

function publishFleet(nex32: boolean): void {
  const hosts = fleetBuildInfo(nex32);
  const ansible = ansibleRecap(nex32);
  emitBuildInfo(hosts);
  emitDeploy({
    id: deployId(nex32),
    service: "order-service",
    status: ansible.status,
    startedAt: new Date().toISOString(),
    ansible,
    hosts,
  });
}

async function refresh(): Promise<void> {
  try {
    faults = await fetchFaults(observability);
    const nex32 = faults["NEX-32"].active;
    if (nex32) {
      sawBreak = true;
    }
    if (publishedNex32 !== nex32 || Date.now() - lastPublish > 5000) {
      publishFleet(nex32);
      publishedNex32 = nex32;
      lastPublish = Date.now();
    }
  } catch {
    // keep last fault snapshot
  }
}

setInterval(() => {
  void refresh();
}, 500);
void refresh();

async function bootLedger(): Promise<void> {
  if (!process.env.ORBIT_DATABASE_URL) {
    return;
  }
  for (;;) {
    try {
      await markOrderRunStarted();
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`orbit orders: could not prepare the order id counter; will not issue ORD-55120 (${message})`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

function pickRouter(): { host: string; version: string } {
  const host = ORDER_ROUTERS[cursor % ORDER_ROUTERS.length];
  cursor += 1;
  const missed = Boolean(faults?.["NEX-32"].active) && host === MISSED_ROUTER;
  return { host, version: missed ? "5.5.3" : "5.6.0" };
}

async function authorize(orderId: string, idempotencyKey: string, traceId: string, amountMinor: number): Promise<number> {
  const response = await fetch(`${paymentsUrl}/v1/authorizations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId, idempotencyKey, traceId, amountMinor }),
  });
  return response.status;
}

function start(): void {
  listen(port, async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "order-service", routers: ORDER_ROUTERS.length, database: Boolean(process.env.ORBIT_DATABASE_URL) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/order-ids") {
    const orderId = await allocateOrderId();
    sendJson(res, 200, { orderId });
    return;
  }
  if (req.method === "GET" && url.pathname === "/v1/orders") {
    const tenant = url.searchParams.get("tenant") ?? "t_brightline";
    const orders = await listOrders(tenant);
    sendJson(res, 200, { orders });
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/v1/orders") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const started = Date.now();
  const body = JSON.parse(await readBody(req)) as {
    orderId: string;
    tenant: string;
    amountMinor: number;
    traceId: string;
    cartId?: string;
    status?: string;
    items?: LedgerItem[];
  };
  const items: LedgerItem[] = body.items && body.items.length > 0
    ? body.items
    : [{ sku: "SKU-ORDER", qty: 1, unitPriceCents: body.amountMinor }];
  if (body.status === "out_of_stock") {
    await insertOrder({
      orderId: body.orderId,
      tenantId: body.tenant,
      cartId: body.cartId ?? null,
      idempotencyKey: null,
      status: "out_of_stock",
      totalCents: body.amountMinor,
      currency: "USD",
      routerId: null,
      serviceVersion: null,
      items,
    });
    sendJson(res, 201, { orderId: body.orderId, status: "out_of_stock" });
    return;
  }
  const router = pickRouter();
  const flag = body.tenant === "t_brightline" || body.tenant === "t_kestrel";
  const order: Order = { id: body.orderId, tenant: body.tenant, fillStatus: "unknown" };
  const charges: { attempt: number; idempotencyKey: string; paymentStatus: number; orderId: string }[] = [];
  const lines: string[] = [];

  async function persistAttempt(attemptOrderId: string, idempotencyKey: string, status: string): Promise<void> {
    await insertOrder({
      orderId: attemptOrderId,
      tenantId: body.tenant,
      cartId: body.cartId ?? null,
      idempotencyKey,
      status,
      totalCents: body.amountMinor,
      currency: "USD",
      routerId: router.host,
      serviceVersion: router.version,
      items,
    });
  }

  if (flag && router.version === "5.5.3") {
    const bulk = new BulkRepricer();
    const clock = clockParts();
    const submissions = bulk.start(
      order,
      true,
      clock.lineTime,
      (attempt) => `idem-${order.id}-a${attempt}-${Math.random().toString(16).slice(2, 10)}`,
      bulkAttempts,
    );
    for (const line of bulk.logs) {
      lines.push(line);
      emitLog({
        timestamp: clock.iso,
        service: "order-service",
        host: router.host,
        level: "INFO",
        line,
        scenario: "NEX-32",
        orderId: body.orderId,
        cartId: body.cartId,
        tenantId: body.tenant,
        routerId: router.host,
        serviceVersion: router.version,
        traceId: body.traceId,
      });
    }
    for (const submission of submissions) {
      const attemptId = attemptOrderId(body.orderId, submission.attempt);
      await persistAttempt(attemptId, submission.idempotencyKey, "authorizing");
      const paymentStatus = await authorize(attemptId, submission.idempotencyKey, body.traceId, body.amountMinor);
      const status = paymentStatus === 200 ? "placed" : "payment_failed";
      await persistAttempt(attemptId, submission.idempotencyKey, status);
      charges.push({
        attempt: submission.attempt,
        idempotencyKey: submission.idempotencyKey,
        paymentStatus,
        orderId: attemptId,
      });
    }
  } else if (flag && router.version === "5.6.0") {
    const pricing = new ContractPricing();
    const clock = clockParts();
    pricing.apply(order.tenant, order.id, clock.lineTime);
    for (const line of pricing.logs) {
      lines.push(line);
      emitLog({ timestamp: clock.iso, service: "order-service", host: router.host, level: "INFO", line });
    }
    const idempotencyKey = `idem-${order.id}-once`;
    await persistAttempt(body.orderId, idempotencyKey, "authorizing");
    const paymentStatus = await authorize(body.orderId, idempotencyKey, body.traceId, body.amountMinor);
    await persistAttempt(body.orderId, idempotencyKey, paymentStatus === 200 ? "placed" : "payment_failed");
    charges.push({ attempt: 1, idempotencyKey, paymentStatus, orderId: body.orderId });
  } else {
    const idempotencyKey = `idem-${order.id}-once`;
    await persistAttempt(body.orderId, idempotencyKey, "authorizing");
    const paymentStatus = await authorize(body.orderId, idempotencyKey, body.traceId, body.amountMinor);
    await persistAttempt(body.orderId, idempotencyKey, paymentStatus === 200 ? "placed" : "payment_failed");
    charges.push({ attempt: 1, idempotencyKey, paymentStatus, orderId: body.orderId });
  }

  const approved = charges.filter((charge) => charge.paymentStatus === 200).length;
  const ok = approved > 0;
  emitMetric({
    timestamp: new Date().toISOString(),
    service: "order-service",
    ok,
    latencyMs: Date.now() - started,
    orderId: body.orderId,
    submissions: charges.length,
  });
  sendJson(res, ok ? 200 : 502, {
    orderId: body.orderId,
    router: router.host,
    version: router.version,
    submissions: charges.length,
    charges,
    lines,
    duplicate: charges.length > 1,
  });
});
}

void bootLedger().then(start);
