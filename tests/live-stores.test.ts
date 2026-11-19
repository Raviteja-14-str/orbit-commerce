// Synthetic demo code for Nexus Intelligence. Not a real system.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bulkBody, indexName, INDEX_TEMPLATE, toOpenSearchDoc } from "../live/observability/ship-logs.ts";
import { insertOrder, insertPayment, listOrders } from "../live/lib/ledger.ts";

test("schema, role, and seed define the orbit ledger", () => {
  const schema = readFileSync("live/db/schema.sql", "utf8");
  const roles = readFileSync("live/db/roles.sql", "utf8");
  const seed = readFileSync("live/db/seed.sql", "utf8");
  for (const table of ["orders", "order_items", "payments"]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(schema, /orders_cart_idx/);
  assert.match(schema, /payments_idempotency_idx/);
  assert.match(roles, /nexus_ro/);
  assert.match(roles, /default_transaction_read_only = on/);
  assert.match(roles, /statement_timeout = '5s'/);
  assert.match(roles, /GRANT SELECT ON ALL TABLES/);
  assert.match(seed, /t_brightline/);
  assert.match(seed, /ON CONFLICT/);
});

test("OpenSearch documents keep the evidence line and the scenario", () => {
  const doc = toOpenSearchDoc({
    timestamp: "2026-11-17T08:00:04.212Z",
    service: "order-service",
    level: "INFO",
    line: "08:00:04.212Z INFO  BulkRepricer: re-submitting order ORD-55120 attempt=1 (fill status unknown)",
    host: "or-router-07",
    scenario: "NEX-32",
    orderId: "ORD-55120",
    cartId: "cart-9",
    tenantId: "t_brightline",
    routerId: "or-router-07",
    serviceVersion: "5.5.3",
    traceId: "abc",
  });
  assert.equal(doc["@timestamp"], "2026-11-17T08:00:04.212Z");
  assert.equal(doc.message.includes("BulkRepricer"), true);
  assert.equal(doc.scenario, "NEX-32");
  assert.equal(doc.router_id, "or-router-07");
  assert.equal(indexName(doc["@timestamp"]), "orbit-logs-2026.11.17");
  const body = bulkBody([doc]);
  assert.match(body, /"_index":"orbit-logs-2026.11.17"/);
  assert.equal(INDEX_TEMPLATE.index_patterns[0], "orbit-logs-*");
  assert.equal(INDEX_TEMPLATE.template.mappings.properties.scenario.type, "keyword");
});

test("ledger stays in memory when ORBIT_DATABASE_URL is unset", async () => {
  const previous = process.env.ORBIT_DATABASE_URL;
  delete process.env.ORBIT_DATABASE_URL;
  const orderId = `ord-mem-${Date.now()}`;
  await insertOrder({
    orderId,
    tenantId: "t_brightline",
    cartId: "cart-mem",
    idempotencyKey: "idem-mem-a1",
    status: "placed",
    totalCents: 1899,
    currency: "USD",
    routerId: "or-router-07",
    serviceVersion: "5.5.3",
    items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
  });
  await insertOrder({
    orderId: `${orderId}-a2`,
    tenantId: "t_brightline",
    cartId: "cart-mem",
    idempotencyKey: "idem-mem-a2",
    status: "placed",
    totalCents: 1899,
    currency: "USD",
    routerId: "or-router-07",
    serviceVersion: "5.5.3",
    items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
  });
  await insertPayment({
    paymentId: `pay-${orderId}`,
    orderId,
    chargeId: `ch-${orderId}`,
    amountCents: 1899,
    status: "captured",
    provider: "card",
    idempotencyKey: "idem-mem-a1",
  });
  const rows = await listOrders("t_brightline");
  const family = rows.filter((row) => row.cartId === "cart-mem");
  assert.equal(family.length, 2);
  assert.equal(family.some((row) => row.charges.length === 1), true);
  if (previous === undefined) {
    delete process.env.ORBIT_DATABASE_URL;
  } else {
    process.env.ORBIT_DATABASE_URL = previous;
  }
});
