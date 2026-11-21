// Synthetic demo code for Nexus Intelligence. Not a real system.

/** First id checkout used when the ledger is empty. A restart must not return here if Postgres already has higher ids. */
export const FIRST_ORDER_NUMBER = 55120;

/** ORD-66381 and ORD-66381-a2 are the same checkout number. Seed ids such as ord-hist-1 are not. */
export function orderNumber(orderId: string): number | null {
  const match = /^ORD-(\d+)(?:-a\d+)?$/.exec(orderId);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function formatOrderId(n: number): string {
  return `ORD-${n}`;
}

export function nextOrderNumber(highest: number | null): number {
  if (highest == null || Number.isNaN(highest)) {
    return FIRST_ORDER_NUMBER;
  }
  return Math.max(FIRST_ORDER_NUMBER, highest + 1);
}

/** NEX-32 stores attempt 1 on the checkout id and later attempts as ORD-<n>-a<attempt>. */
export function attemptOrderId(baseOrderId: string, attempt: number): string {
  if (attempt <= 1) {
    return baseOrderId;
  }
  return `${baseOrderId}-a${attempt}`;
}

/** A payment may attach only to an order created during the current order-service run. */
export function paymentAttachesToCurrentRun(orderCreatedAt: Date | null, runStartedAt: Date | null): boolean {
  if (orderCreatedAt == null || runStartedAt == null) {
    return false;
  }
  return orderCreatedAt.getTime() >= runStartedAt.getTime();
}
