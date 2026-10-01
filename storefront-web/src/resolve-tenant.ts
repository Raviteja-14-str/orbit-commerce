// Synthetic demo code for Nexus Intelligence. Not a real system.

export const STORE_NOT_FOUND = "Store not found";

export interface TenantRecord {
  id: string;
  host: string;
  /** Hard-deleted tenants are absent. A tombstone is treated as missing. */
  status: "active" | "deleted";
}

export interface StorefrontResponse {
  status: number;
  body: string;
  tenantId?: string;
}

/**
 * Merchant host -> tenant. Missing tenants are a 404 with body "Store not found".
 * Example host: shop.northwind.example
 */
export function resolveStorefront(
  host: string,
  lookup: (host: string) => TenantRecord | null,
): StorefrontResponse {
  const tenant = lookup(host);
  if (!tenant || tenant.status === "deleted") {
    return { status: 404, body: STORE_NOT_FOUND };
  }
  return { status: 200, body: "ok", tenantId: tenant.id };
}
