// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Route {
  dst: string;
  via: string;
}

/** Cilium agent log line when a pod CIDR route via cilium_host is gone. */
export function routeMissingMessage(cidr: string): string {
  return `level=error msg="route to ${cidr} via cilium_host missing"`;
}

export function checkPodRoute(cidr: string, routes: Route[]): string | null {
  const present = routes.some((route) => route.dst === cidr && route.via === "cilium_host");
  if (!present) {
    return routeMissingMessage(cidr);
  }
  return null;
}
