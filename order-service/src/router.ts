// Synthetic demo code for Nexus Intelligence. Not a real system.

import { BulkRepricer, type Order, type Submission } from "./bulk-repricer.ts";

export interface RouterResult {
  version: string;
  path: "submit-once" | "bulk-repricer";
  logs: string[];
  submissions: Submission[];
}

/**
 * order-router 5.5.3 entrypoint.
 * ENABLE_BULK_REPRICE selects BulkRepricer. There is no contract-pricing path.
 */
export function handleOrder(
  version: string,
  flagEnabled: boolean,
  order: Order,
  ts: string,
  nextKey: (attempt: number) => string,
): RouterResult {
  if (version !== "5.5.3") {
    throw new Error(`order-router ${version} is not this build`);
  }
  if (!flagEnabled) {
    return {
      version,
      path: "submit-once",
      logs: [],
      submissions: [{ orderId: order.id, attempt: 1, idempotencyKey: nextKey(1) }],
    };
  }
  const bulk = new BulkRepricer();
  const submissions = bulk.start(order, true, ts, nextKey, 3);
  return { version, path: "bulk-repricer", logs: bulk.logs, submissions };
}
