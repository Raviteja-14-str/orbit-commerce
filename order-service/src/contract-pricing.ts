// Synthetic demo code for Nexus Intelligence. Not a real system.

/**
 * B2B contract price applied by order-service 5.6.0 when ENABLE_BULK_REPRICE
 * is on. One submission, one idempotency key. This replaced the legacy
 * BulkRepricer on hosts that actually received 5.6.0.
 */
export class ContractPricing {
  readonly logs: string[] = [];

  apply(tenant: string, orderId: string, ts: string): void {
    this.logs.push(`${ts} INFO  ContractPricing: applied contract price tenant=${tenant} order=${orderId}`);
  }
}
