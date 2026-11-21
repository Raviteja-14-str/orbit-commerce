// Synthetic demo code for Nexus Intelligence. Not a real system.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { allocateOrderId, insertOrder, insertPayment, listOrders } from "../live/lib/ledger.ts";
import { attemptOrderId, formatOrderId, nextOrderNumber, orderNumber, paymentAttachesToCurrentRun } from "../live/lib/order-ids.ts";

test("order numbers survive the NEX-32 suffix and a restart high-water mark", () => {
  assert.equal(orderNumber("ORD-66381"), 66381);
  assert.equal(orderNumber("ORD-55222-a2"), 55222);
  assert.equal(orderNumber("ord-hist-1"), null);
  assert.equal(nextOrderNumber(null), 55120);
  assert.equal(nextOrderNumber(66381), 66382);
  assert.equal(formatOrderId(66382), "ORD-66382");
  assert.equal(attemptOrderId("ORD-66382", 1), "ORD-66382");
  assert.equal(attemptOrderId("ORD-66382", 2), "ORD-66382-a2");
  assert.equal(attemptOrderId("ORD-66382", 4), "ORD-66382-a4");
  const attempts = [1, 2, 3, 4].map((attempt) => attemptOrderId("ORD-66382", attempt));
  assert.equal(new Set(attempts).size, 4);
});

test("payments do not attach to an order from before this run", () => {
  const runStarted = new Date("2026-11-21T14:00:00.000Z");
  assert.equal(paymentAttachesToCurrentRun(new Date("2026-11-21T13:00:00.000Z"), runStarted), false);
  assert.equal(paymentAttachesToCurrentRun(new Date("2026-11-21T14:00:01.000Z"), runStarted), true);
  assert.equal(paymentAttachesToCurrentRun(null, runStarted), false);
  assert.equal(paymentAttachesToCurrentRun(runStarted, null), false);
});

test("memory mode still accepts orders and payments without a database", async () => {
  const previous = process.env.ORBIT_DATABASE_URL;
  delete process.env.ORBIT_DATABASE_URL;
  const first = await allocateOrderId();
  const second = await allocateOrderId();
  assert.equal(first, "ORD-55120");
  assert.equal(second, "ORD-55121");
  await insertOrder({
    orderId: first,
    tenantId: "t_brightline",
    cartId: "cart-mem-restart",
    idempotencyKey: "idem-mem",
    status: "authorizing",
    totalCents: 1899,
    currency: "USD",
    routerId: "or-router-01",
    serviceVersion: "5.6.0",
    items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
  });
  await insertOrder({
    orderId: first,
    tenantId: "t_brightline",
    cartId: "cart-mem-restart",
    idempotencyKey: "idem-mem",
    status: "placed",
    totalCents: 1899,
    currency: "USD",
    routerId: "or-router-01",
    serviceVersion: "5.6.0",
    items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
  });
  await insertPayment({
    paymentId: "pay-mem-restart",
    orderId: first,
    chargeId: "ch-mem-restart",
    amountCents: 1899,
    status: "captured",
    provider: "card",
    idempotencyKey: "idem-mem",
  });
  const rows = await listOrders("t_brightline");
  const row = rows.find((item) => item.orderId === first);
  assert.equal(row?.status, "placed");
  assert.equal(row?.charges.length, 1);
  if (previous === undefined) {
    delete process.env.ORBIT_DATABASE_URL;
  } else {
    process.env.ORBIT_DATABASE_URL = previous;
  }
});

test("checkout no longer resets to ORD-55120 in the process", () => {
  const checkout = readFileSync("live/checkout/server.ts", "utf8");
  const orders = readFileSync("live/orders/server.ts", "utf8");
  assert.equal(checkout.includes("orderSequence"), false);
  assert.match(checkout, /\/v1\/order-ids/);
  assert.match(orders, /attemptOrderId/);
  assert.match(readFileSync("live/db/schema.sql", "utf8"), /order_counters/);
  assert.match(readFileSync("live/lib/ledger.ts", "utf8"), /previous run/);
});
