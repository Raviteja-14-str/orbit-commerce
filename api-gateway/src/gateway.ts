// Synthetic demo code for Nexus Intelligence. Not a real system.

/** Public edge of the origin. The CDN calls this after WAF evaluation. */
export function upstreamFor(path: string): string {
  if (path === "/login" || path.startsWith("/login?")) {
    return "auth-sso";
  }
  if (path.startsWith("/checkout") || path.startsWith("/v1/orders")) {
    return "checkout";
  }
  if (path.startsWith("/v1/authorizations")) {
    return "payments-gateway";
  }
  if (path.startsWith("/v1/prices")) {
    return "pricing-service";
  }
  return "storefront-web";
}
