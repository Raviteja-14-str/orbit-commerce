// Synthetic demo code for Nexus Intelligence. Not a real system.

/**
 * Orbit POS app. It starts only after the kiosk OS has a user session
 * (the login screen has completed). The app does not install kernel drivers,
 * does not update third-party endpoint agents, and does not run during early boot.
 * A crash before app_started is outside this process.
 */
export function boot(sessionReady: boolean): { event: "app_started" | "not_started" } {
  if (!sessionReady) {
    return { event: "not_started" };
  }
  return { event: "app_started" };
}

export function heartbeat(version: string, seq: number): string {
  return `pos heartbeat seq=${seq} version=${version} event=app_started`;
}
