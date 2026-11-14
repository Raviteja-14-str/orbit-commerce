// Synthetic demo code for Nexus Intelligence. Not a real system.

import { getTotals } from "../../cart/src/cart.ts";
import { reserveStock } from "../../checkout/src/reserve-stock.ts";
import { clockParts } from "../lib/clock.ts";
import { fetchFaults, type FaultState } from "../lib/faults.ts";
import { listen, readBody, sendJson } from "../lib/http.ts";
import { emitLog, emitMetric, emitTrace, type TraceSpan } from "../lib/telemetry.ts";

const port = Number(process.env.PORT ?? 4412);
const observability = process.env.OBSERVABILITY_URL ?? "http://127.0.0.1:4400";
const cartUrl = process.env.CART_URL ?? "http://127.0.0.1:4410";
const pricingUrl = process.env.PRICING_URL ?? "http://127.0.0.1:4411";
const ordersUrl = process.env.ORDERS_URL ?? "http://127.0.0.1:4414";

let faults: FaultState | null = null;
let orderSequence = 55120;

setInterval(() => {
  void fetchFaults(observability)
    .then((next) => {
      faults = next;
    })
    .catch(() => undefined);
}, 500);

async function quote(sku: string): Promise<number | null> {
  const response = await fetch(`${pricingUrl}/quote?sku=${encodeURIComponent(sku)}&region=us-east`);
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { amountMinor?: number };
  return typeof body.amountMinor === "number" ? body.amountMinor : null;
}

function traceId(): string {
  return Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

listen(port, async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "checkout" });
    return;
  }
  if (req.method !== "POST" || url.pathname !== "/v1/checkout") {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const started = Date.now();
  const body = JSON.parse(await readBody(req)) as { cartId?: string };
  const spans: TraceSpan[] = [];
  const id = traceId();
  const startedAt = new Date().toISOString();
  if (!body.cartId) {
    sendJson(res, 400, { error: "cartId required" });
    return;
  }
  const cartResponse = await fetch(`${cartUrl}/v1/carts/${encodeURIComponent(body.cartId)}`);
  if (!cartResponse.ok) {
    sendJson(res, 404, { error: "cart not found" });
    return;
  }
  const cart = (await cartResponse.json()) as { id: string; tenant: string; lines: { sku: string; qty: number }[] };
  const quoteStarted = Date.now();
  const prefetched = new Map<string, number>();
  for (const line of cart.lines) {
    const amount = await quote(line.sku);
    if (amount == null) {
      sendJson(res, 502, { error: "Price unavailable", traceId: id });
      return;
    }
    prefetched.set(line.sku, amount);
  }
  const priced = getTotals(cart.lines, (sku) => prefetched.get(sku) ?? null);
  spans.push({ name: "cart.get_totals", service: "cart", durationMs: 1, status: "OK" });
  spans.push({
    name: "pricing.quote",
    service: "pricing-service",
    durationMs: Date.now() - quoteStarted,
    status: priced.error ? "ERROR" : "OK",
  });
  if (priced.error || priced.totalMinor == null) {
    sendJson(res, 502, { error: "Price unavailable", traceId: id });
    return;
  }

  const reserveClock = clockParts();
  const dnsDown = Boolean(faults?.["NEX-30"].active);
  const reserved = reserveStock(
    dnsDown ? { ok: false, reason: "no-such-host" } : { ok: true },
    12,
    reserveClock.lineTime,
    id,
  );
  if (reserved.log) {
    emitLog({
      timestamp: reserveClock.iso,
      service: "checkout",
      level: "ERROR",
      line: reserved.log,
    });
  }
  if (reserved.status !== "reserved") {
    spans.push({ name: "checkout.place_order", service: "checkout", durationMs: Date.now() - started, status: "ERROR" });
    emitTrace({ traceId: id, root: "checkout.place_order", status: "ERROR", durationMs: Date.now() - started, startedAt, spans });
    emitMetric({ timestamp: new Date().toISOString(), service: "checkout", ok: false, latencyMs: Date.now() - started });
    sendJson(res, 409, { error: "OUT_OF_STOCK", traceId: id, log: reserved.log ?? null });
    return;
  }

  const orderId = `ORD-${orderSequence}`;
  orderSequence += 1;
  const orderStarted = Date.now();
  const orderResponse = await fetch(`${ordersUrl}/v1/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId, tenant: cart.tenant, amountMinor: priced.totalMinor, traceId: id }),
  });
  const orderBody = (await orderResponse.json()) as {
    router: string;
    version: string;
    submissions: number;
    charges: { attempt: number; idempotencyKey: string; paymentStatus: number }[];
    lines: string[];
    duplicate: boolean;
  };
  const payOk = orderResponse.ok;
  spans.push({
    name: "payments.authorize",
    service: "payments-gateway",
    durationMs: Date.now() - orderStarted,
    status: payOk ? "OK" : "ERROR",
  });
  spans.push({
    name: "risk.score",
    service: "payments-gateway",
    durationMs: 1,
    status: payOk ? "OK" : "ERROR",
  });
  spans.push({
    name: "order.created",
    service: "order-service",
    durationMs: Date.now() - orderStarted,
    status: payOk ? "OK" : "ERROR",
  });
  const durationMs = Date.now() - started;
  spans.unshift({ name: "checkout.place_order", service: "checkout", durationMs, status: payOk ? "OK" : "ERROR" });
  emitTrace({
    traceId: id,
    root: "checkout.place_order",
    status: payOk ? "OK" : "ERROR",
    durationMs,
    startedAt,
    spans,
  });
  emitMetric({
    timestamp: new Date().toISOString(),
    service: "checkout",
    ok: payOk,
    latencyMs: durationMs,
    orderId,
    submissions: orderBody.submissions,
  });
  sendJson(res, payOk ? 200 : 502, {
    orderId,
    traceId: id,
    tenant: cart.tenant,
    totalMinor: priced.totalMinor,
    router: orderBody.router,
    version: orderBody.version,
    duplicate: orderBody.duplicate,
    charges: orderBody.charges,
    lines: orderBody.lines,
    error: payOk ? null : "payment_failed",
  });
});
