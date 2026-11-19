// Synthetic demo code for Nexus Intelligence. Not a real system.

/** Internal service-discovery name published by dns-sync. */
export const INVENTORY_HOST = "inventory.svc.orbit.internal";

/** Cluster DNS resolver used by checkout pods. */
export const DNS_RESOLVER = "10.0.0.2:53";

export interface DnsLookup {
  ok: boolean;
  reason?: "no-such-host" | "other";
}

export interface ReserveResult {
  status: "reserved" | "OUT_OF_STOCK";
  log?: string;
}

/**
 * A failed DNS lookup is mapped to OUT_OF_STOCK. Callers cannot tell a
 * missing inventory.svc record set apart from an empty warehouse.
 */
export function reserveStock(lookup: DnsLookup, onHand: number, ts: string, traceId: string): ReserveResult {
  if (!lookup.ok && lookup.reason === "no-such-host") {
    return {
      status: "OUT_OF_STOCK",
      log:
        `${ts} ERROR reserve_stock failed: dial tcp: lookup ${INVENTORY_HOST} on ${DNS_RESOLVER}: no such host` +
        ` -> mapped to OUT_OF_STOCK trace_id=${traceId}`,
    };
  }
  if (!lookup.ok || onHand <= 0) {
    return { status: "OUT_OF_STOCK" };
  }
  return { status: "reserved" };
}
