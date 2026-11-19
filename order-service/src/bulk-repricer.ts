// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Order {
  id: string;
  tenant: string;
  /** Legacy repricer treats "unknown" as "try again". It never writes "filled". */
  fillStatus: "unknown" | "filled";
}

export interface Submission {
  orderId: string;
  attempt: number;
  idempotencyKey: string;
}

/**
 * Retired bulk reprice loop, still what order-service 5.5.3 runs when
 * ENABLE_BULK_REPRICE is true. Each pass mints a new idempotency key, so
 * payments-gateway accepts the resubmit as a new charge. Fill status is
 * never observed, so the loop does not stop on its own.
 */
export class BulkRepricer {
  readonly logs: string[] = [];
  readonly submissions: Submission[] = [];

  start(order: Order, enabled: boolean, ts: string, nextKey: (attempt: number) => string, maxAttempts = 14): Submission[] {
    this.logs.push(`${ts} INFO  BulkRepricer: ENABLE_BULK_REPRICE=${enabled}, starting legacy reprice loop`);
    if (!enabled) {
      return [];
    }
    let attempt = 1;
    while (order.fillStatus === "unknown" && attempt <= maxAttempts) {
      const idempotencyKey = nextKey(attempt);
      this.logs.push(
        `${ts} INFO  BulkRepricer: re-submitting order ${order.id} attempt=${attempt} (fill status unknown)`,
      );
      this.submissions.push({ orderId: order.id, attempt, idempotencyKey });
      attempt += 1;
    }
    return this.submissions;
  }
}
