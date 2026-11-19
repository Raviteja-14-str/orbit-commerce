// Synthetic demo code for Nexus Intelligence. Not a real system.

import { BulkRepricer, type Order, type Submission } from "./bulk-repricer.ts";
import { ContractPricing } from "./contract-pricing.ts";

export interface RouterResult {
  version: string;
  path: "submit-once" | "bulk-repricer" | "contract-pricing";
  logs: string[];
  submissions: Submission[];
}

/**
 * order-router entry.
 * 5.6.0 reuses ENABLE_BULK_REPRICE for ContractPricing.
 * 5.5.3 still maps that flag to BulkRepricer. A host the deploy did not reach
 * (see deploy/ansible) keeps running 5.5.3 and the legacy loop.
 */
export function handleOrder(
  version: string,
  flagEnabled: boolean,
  order: Order,
  ts: string,
  nextKey: (attempt: number) => string,
): RouterResult {
  if (!flagEnabled) {
    return {
      version,
      path: "submit-once",
      logs: [],
      submissions: [{ orderId: order.id, attempt: 1, idempotencyKey: nextKey(1) }],
    };
  }
  if (version === "5.5.3") {
    const bulk = new BulkRepricer();
    const submissions = bulk.start(order, true, ts, nextKey, 3);
    return { version, path: "bulk-repricer", logs: bulk.logs, submissions };
  }
  if (version === "5.6.0") {
    const pricing = new ContractPricing();
    pricing.apply(order.tenant, order.id, ts);
    return {
      version,
      path: "contract-pricing",
      logs: pricing.logs,
      submissions: [{ orderId: order.id, attempt: 1, idempotencyKey: nextKey(1) }],
    };
  }
  throw new Error(`order-router ${version} is not this build`);
}
