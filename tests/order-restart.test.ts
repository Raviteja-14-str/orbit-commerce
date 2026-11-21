// Synthetic demo code for Nexus Intelligence. Not a real system.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { closePools } from "../live/lib/db.ts";
import {
  allocateOrderId,
  insertOrder,
  insertPayment,
  LedgerError,
  markOrderRunStarted,
} from "../live/lib/ledger.ts";

const database = "orbit_restart_test";

function psql(db: string, sql: string): string {
  return execFileSync("psql", ["-d", db, "-v", "ON_ERROR_STOP=1", "-tAc", sql], { encoding: "utf8" }).trim();
}

function postgresUp(): boolean {
  try {
    execFileSync("psql", ["-d", "postgres", "-tAc", "SELECT 1"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

test("a restart issues new order ids and will not pay an older order", async (t) => {
  if (!postgresUp()) {
    t.skip("postgres is not available");
    return;
  }
  psql("postgres", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid()`);
  psql("postgres", `DROP DATABASE IF EXISTS ${database}`);
  psql("postgres", `CREATE DATABASE ${database}`);
  execFileSync("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "live/db/schema.sql"], { stdio: "pipe" });
  psql(
    database,
    `INSERT INTO orders (order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version, created_at)
     VALUES
       ('ORD-66381', 't_brightline', 'cart-old', 'idem-old', 'placed', 1899, 'USD', 'or-router-02', '5.6.0', '2020-01-01+00'),
       ('ORD-55222-a2', 't_brightline', 'cart-older', 'idem-a2', 'placed', 1899, 'USD', 'or-router-07', '5.5.3', '2020-01-02+00')`,
  );
  process.env.ORBIT_DATABASE_URL = `postgresql://ubuntu@/${database}?host=/var/run/postgresql`;
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map((part) => String(part)).join(" "));
  };
  try {
    await markOrderRunStarted();
    const first = await allocateOrderId();
    const second = await allocateOrderId();
    assert.equal(first, "ORD-66382");
    assert.equal(second, "ORD-66383");
    await insertOrder({
      orderId: first,
      tenantId: "t_brightline",
      cartId: "cart-new",
      idempotencyKey: "idem-new",
      status: "authorizing",
      totalCents: 1899,
      currency: "USD",
      routerId: "or-router-07",
      serviceVersion: "5.5.3",
      items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
    });
    await insertOrder({
      orderId: first,
      tenantId: "t_brightline",
      cartId: "cart-new",
      idempotencyKey: "idem-new",
      status: "placed",
      totalCents: 1899,
      currency: "USD",
      routerId: "or-router-07",
      serviceVersion: "5.5.3",
      items: [{ sku: "SKU-HAMMER", qty: 1, unitPriceCents: 1899 }],
    });
    await assert.rejects(
      insertOrder({
        orderId: "ORD-66381",
        tenantId: "t_brightline",
        cartId: "cart-collided",
        idempotencyKey: "idem-collided",
        status: "placed",
        totalCents: 1,
        currency: "USD",
        routerId: "or-router-07",
        serviceVersion: "5.5.3",
        items: [],
      }),
      LedgerError,
    );
    await assert.rejects(
      insertPayment({
        paymentId: "pay-old-restart",
        orderId: "ORD-55222-a2",
        chargeId: "ch-old-restart",
        amountCents: 1899,
        status: "captured",
        provider: "card",
        idempotencyKey: "idem-old-restart",
      }),
      LedgerError,
    );
    await insertPayment({
      paymentId: "pay-new-restart",
      orderId: first,
      chargeId: "ch-new-restart",
      amountCents: 1899,
      status: "captured",
      provider: "card",
      idempotencyKey: "idem-new-restart",
    });
    assert.equal(psql(database, "SELECT count(*) FROM orders"), "3");
    assert.equal(psql(database, "SELECT cart_id FROM orders WHERE order_id = 'ORD-66381'"), "cart-old");
    assert.equal(psql(database, "SELECT status FROM orders WHERE order_id = 'ORD-66382'"), "placed");
    assert.equal(psql(database, "SELECT count(*) FROM payments WHERE order_id = 'ORD-55222-a2'"), "0");
    assert.equal(psql(database, "SELECT count(*) FROM payments WHERE order_id = 'ORD-66382'"), "1");
    const text = logged.join("\n");
    assert.match(text, /refusing to overwrite order ORD-66381/);
    assert.match(text, /refusing payment pay-old-restart for order ORD-55222-a2/);
  } finally {
    console.error = original;
    await closePools();
    delete process.env.ORBIT_DATABASE_URL;
    psql("postgres", `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid()`);
    psql("postgres", `DROP DATABASE IF EXISTS ${database}`);
  }
});
