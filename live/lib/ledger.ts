// Synthetic demo code for Nexus Intelligence. Not a real system.

import { getPool } from "./db.ts";
import { FIRST_ORDER_NUMBER, formatOrderId, orderNumber } from "./order-ids.ts";

export interface LedgerItem {
  sku: string;
  qty: number;
  unitPriceCents: number;
}

export interface LedgerOrder {
  orderId: string;
  tenantId: string;
  cartId: string | null;
  idempotencyKey: string | null;
  status: string;
  totalCents: number;
  currency: string;
  routerId: string | null;
  serviceVersion: string | null;
  createdAt?: string;
  items: LedgerItem[];
}

export interface LedgerPayment {
  paymentId: string;
  orderId: string;
  chargeId: string;
  amountCents: number;
  status: string;
  provider: string;
  idempotencyKey: string | null;
  createdAt?: string;
}

export interface ListedOrder extends LedgerOrder {
  createdAt: string;
  charges: {
    paymentId: string;
    chargeId: string;
    amountCents: number;
    status: string;
    provider: string;
    idempotencyKey: string | null;
    createdAt: string;
  }[];
}

const memoryOrders: LedgerOrder[] = [];
const memoryPayments: LedgerPayment[] = [];
const ownedOrderIds = new Set<string>();
let memoryNext = FIRST_ORDER_NUMBER;

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

function logLedger(message: string): void {
  console.error(`orbit ledger: ${message}`);
}

async function writeItems(orderId: string, items: LedgerItem[]): Promise<void> {
  const pool = getPool();
  if (!pool) {
    return;
  }
  for (const item of items) {
    await pool.query(
      `INSERT INTO order_items (order_id, sku, qty, unit_price_cents)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id, sku) DO UPDATE SET qty = EXCLUDED.qty, unit_price_cents = EXCLUDED.unit_price_cents`,
      [orderId, item.sku, item.qty, item.unitPriceCents],
    );
  }
}

/** Create the counter and run watermark if this process is using Postgres. */
export async function prepareLedger(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    return;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS order_counters (
    name text PRIMARY KEY,
    next_value bigint NOT NULL
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS service_runs (
    service text PRIMARY KEY,
    started_at timestamptz NOT NULL
  )`);
  await pool.query(
    `INSERT INTO order_counters (name, next_value)
     SELECT 'order', GREATEST(55120::bigint, COALESCE((
       SELECT max((regexp_match(order_id, '^ORD-([0-9]+)'))[1]::bigint) + 1
       FROM orders
       WHERE order_id ~ '^ORD-[0-9]+'
     ), 55120::bigint))
     ON CONFLICT (name) DO NOTHING`,
  );
  await pool.query(
    `UPDATE order_counters AS counters
     SET next_value = GREATEST(counters.next_value, COALESCE(high.highest, counters.next_value))
     FROM (
       SELECT max((regexp_match(order_id, '^ORD-([0-9]+)'))[1]::bigint) + 1 AS highest
       FROM orders
       WHERE order_id ~ '^ORD-[0-9]+'
     ) AS high
     WHERE counters.name = 'order'`,
  );
}

/** Call once when order-service starts. Orders created before this moment are a previous run. */
export async function markOrderRunStarted(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    return;
  }
  await prepareLedger();
  await pool.query(
    `INSERT INTO service_runs (service, started_at)
     VALUES ('order-service', clock_timestamp())
     ON CONFLICT (service) DO UPDATE SET started_at = EXCLUDED.started_at`,
  );
}

export async function highestOrderNumber(): Promise<number | null> {
  const pool = getPool();
  if (!pool) {
    let highest: number | null = null;
    for (const order of memoryOrders) {
      const value = orderNumber(order.orderId);
      if (value != null && (highest == null || value > highest)) {
        highest = value;
      }
    }
    return highest;
  }
  const result = await pool.query(
    `SELECT max((regexp_match(order_id, '^ORD-([0-9]+)'))[1]::bigint) AS highest
     FROM orders
     WHERE order_id ~ '^ORD-[0-9]+'`,
  );
  const value = result.rows[0]?.highest;
  return value == null ? null : Number(value);
}

export async function allocateOrderId(): Promise<string> {
  const pool = getPool();
  if (!pool) {
    const highest = await highestOrderNumber();
    if (highest != null && memoryNext <= highest) {
      memoryNext = highest + 1;
    }
    const id = formatOrderId(memoryNext);
    memoryNext += 1;
    return id;
  }
  await prepareLedger();
  const result = await pool.query(
    `UPDATE order_counters
     SET next_value = next_value + 1
     WHERE name = 'order'
     RETURNING next_value - 1 AS issued`,
  );
  const issued = result.rows[0]?.issued;
  if (issued == null) {
    const message = "order id counter is missing; refusing to fall back to ORD-55120";
    logLedger(message);
    throw new LedgerError(message);
  }
  return formatOrderId(Number(issued));
}

export async function insertOrder(order: LedgerOrder): Promise<void> {
  const pool = getPool();
  if (!pool) {
    const existing = memoryOrders.findIndex((row) => row.orderId === order.orderId);
    if (existing >= 0) {
      memoryOrders[existing] = order;
    } else {
      memoryOrders.push(order);
    }
    ownedOrderIds.add(order.orderId);
    return;
  }
  try {
    if (ownedOrderIds.has(order.orderId)) {
      const updated = await pool.query(
        `UPDATE orders
         SET tenant_id = $2, cart_id = $3, idempotency_key = $4, status = $5,
             total_cents = $6, currency = $7, router_id = $8, service_version = $9
         WHERE order_id = $1`,
        [
          order.orderId,
          order.tenantId,
          order.cartId,
          order.idempotencyKey,
          order.status,
          order.totalCents,
          order.currency,
          order.routerId,
          order.serviceVersion,
        ],
      );
      if (updated.rowCount === 0) {
        ownedOrderIds.delete(order.orderId);
        const message = `order ${order.orderId} disappeared before its status update`;
        logLedger(message);
        throw new LedgerError(message);
      }
      await writeItems(order.orderId, order.items);
      return;
    }
    const inserted = await pool.query(
      `INSERT INTO orders (order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING order_id`,
      [
        order.orderId,
        order.tenantId,
        order.cartId,
        order.idempotencyKey,
        order.status,
        order.totalCents,
        order.currency,
        order.routerId,
        order.serviceVersion,
      ],
    );
    if ((inserted.rowCount ?? 0) === 0) {
      const message = `refusing to overwrite order ${order.orderId}; that id already exists from a previous run`;
      logLedger(message);
      throw new LedgerError(message);
    }
    ownedOrderIds.add(order.orderId);
    await writeItems(order.orderId, order.items);
  } catch (error) {
    if (error instanceof LedgerError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logLedger(`insert order ${order.orderId} failed: ${message}`);
    throw error;
  }
}

export async function insertPayment(payment: LedgerPayment): Promise<void> {
  const pool = getPool();
  if (!pool) {
    memoryPayments.push(payment);
    return;
  }
  try {
    const result = await pool.query(
      `WITH target AS (
         SELECT orders.order_id
         FROM orders
         JOIN service_runs ON service_runs.service = 'order-service'
         WHERE orders.order_id = $2
           AND orders.created_at >= service_runs.started_at
       ),
       inserted AS (
         INSERT INTO payments (payment_id, order_id, charge_id, amount_cents, status, provider, idempotency_key)
         SELECT $1, target.order_id, $3, $4, $5, $6, $7
         FROM target
         ON CONFLICT (payment_id) DO NOTHING
         RETURNING payment_id
       )
       SELECT
         (SELECT count(*)::int FROM target) AS eligible,
         (SELECT count(*)::int FROM inserted) AS inserted`,
      [
        payment.paymentId,
        payment.orderId,
        payment.chargeId,
        payment.amountCents,
        payment.status,
        payment.provider,
        payment.idempotencyKey,
      ],
    );
    const eligible = Number(result.rows[0]?.eligible ?? 0);
    const inserted = Number(result.rows[0]?.inserted ?? 0);
    if (eligible === 0) {
      const message = `refusing payment ${payment.paymentId} for order ${payment.orderId}; that order is missing or from a previous run`;
      logLedger(message);
      throw new LedgerError(message);
    }
    if (inserted === 0) {
      const message = `refusing payment ${payment.paymentId}; that payment id already exists and was not inserted`;
      logLedger(message);
      throw new LedgerError(message);
    }
  } catch (error) {
    if (error instanceof LedgerError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    logLedger(`insert payment ${payment.paymentId} failed: ${message}`);
    throw error;
  }
}

export async function listOrders(tenantId: string): Promise<ListedOrder[]> {
  const pool = getPool();
  if (!pool) {
    return memoryOrders
      .filter((order) => order.tenantId === tenantId)
      .map((order) => ({
        ...order,
        createdAt: order.createdAt ?? new Date().toISOString(),
        charges: memoryPayments
          .filter((payment) => payment.orderId === order.orderId)
          .map((payment) => ({
            paymentId: payment.paymentId,
            chargeId: payment.chargeId,
            amountCents: payment.amountCents,
            status: payment.status,
            provider: payment.provider,
            idempotencyKey: payment.idempotencyKey,
            createdAt: payment.createdAt ?? new Date().toISOString(),
          })),
      }));
  }
  const orders = await pool.query(
    `SELECT order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version, created_at
     FROM orders WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [tenantId],
  );
  const ids = orders.rows.map((row) => row.order_id as string);
  if (ids.length === 0) {
    return [];
  }
  const items = await pool.query(
    `SELECT order_id, sku, qty, unit_price_cents FROM order_items WHERE order_id = ANY($1::text[])`,
    [ids],
  );
  const payments = await pool.query(
    `SELECT payment_id, order_id, charge_id, amount_cents, status, provider, idempotency_key, created_at
     FROM payments WHERE order_id = ANY($1::text[]) ORDER BY created_at`,
    [ids],
  );
  return orders.rows.map((row) => ({
    orderId: row.order_id as string,
    tenantId: row.tenant_id as string,
    cartId: (row.cart_id as string | null) ?? null,
    idempotencyKey: (row.idempotency_key as string | null) ?? null,
    status: row.status as string,
    totalCents: Number(row.total_cents),
    currency: row.currency as string,
    routerId: (row.router_id as string | null) ?? null,
    serviceVersion: (row.service_version as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    items: items.rows
      .filter((item) => item.order_id === row.order_id)
      .map((item) => ({
        sku: item.sku as string,
        qty: Number(item.qty),
        unitPriceCents: Number(item.unit_price_cents),
      })),
    charges: payments.rows
      .filter((payment) => payment.order_id === row.order_id)
      .map((payment) => ({
        paymentId: payment.payment_id as string,
        chargeId: payment.charge_id as string,
        amountCents: Number(payment.amount_cents),
        status: payment.status as string,
        provider: payment.provider as string,
        idempotencyKey: (payment.idempotency_key as string | null) ?? null,
        createdAt: new Date(payment.created_at as string).toISOString(),
      })),
  }));
}
