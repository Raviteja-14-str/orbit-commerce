// Synthetic demo code for Nexus Intelligence. Not a real system.

import { getPool } from "./db.ts";

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

export async function insertOrder(order: LedgerOrder): Promise<void> {
  const pool = getPool();
  if (!pool) {
    const existing = memoryOrders.findIndex((row) => row.orderId === order.orderId);
    if (existing >= 0) {
      memoryOrders[existing] = order;
    } else {
      memoryOrders.push(order);
    }
    return;
  }
  await pool.query(
    `INSERT INTO orders (order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (order_id) DO UPDATE SET status = EXCLUDED.status, total_cents = EXCLUDED.total_cents,
       router_id = EXCLUDED.router_id, service_version = EXCLUDED.service_version`,
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
  for (const item of order.items) {
    await pool.query(
      `INSERT INTO order_items (order_id, sku, qty, unit_price_cents)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (order_id, sku) DO UPDATE SET qty = EXCLUDED.qty, unit_price_cents = EXCLUDED.unit_price_cents`,
      [order.orderId, item.sku, item.qty, item.unitPriceCents],
    );
  }
}

export async function insertPayment(payment: LedgerPayment): Promise<void> {
  const pool = getPool();
  if (!pool) {
    memoryPayments.push(payment);
    return;
  }
  await pool.query(
    `INSERT INTO payments (payment_id, order_id, charge_id, amount_cents, status, provider, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (payment_id) DO NOTHING`,
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
