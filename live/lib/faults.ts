// Synthetic demo code for Nexus Intelligence. Not a real system.

export const NEX28_PERIOD_MS = Number(process.env.ORBIT_NEX28_PERIOD_MS ?? 300_000);
export const NEX28_FAIL_MS = Number(process.env.ORBIT_NEX28_FAIL_MS ?? 150_000);
export const FEATURE_LIMIT = 200;
export const FEATURES_HEALTHY = 189;
export const FEATURES_OVER_LIMIT = 412;

export interface FaultSlice {
  active: boolean;
  activatedAt: string | null;
  periodMs: number;
  failMs: number;
}

export interface FaultState {
  "NEX-32": FaultSlice;
  "NEX-28": FaultSlice;
  "NEX-30": FaultSlice;
}

export function emptyFaults(): FaultState {
  const slice = (): FaultSlice => ({
    active: false,
    activatedAt: null,
    periodMs: NEX28_PERIOD_MS,
    failMs: NEX28_FAIL_MS,
  });
  return { "NEX-32": slice(), "NEX-28": slice(), "NEX-30": slice() };
}

/** First failMs of every periodMs cycle fails, starting at activation. */
export function nex28Phase(fault: FaultSlice, now = Date.now()): "failing" | "healthy" {
  if (!fault.active || !fault.activatedAt) {
    return "healthy";
  }
  const start = Date.parse(fault.activatedAt);
  if (Number.isNaN(start)) {
    return "healthy";
  }
  const period = fault.periodMs > 0 ? fault.periodMs : NEX28_PERIOD_MS;
  const failFor = fault.failMs > 0 ? fault.failMs : NEX28_FAIL_MS;
  const elapsed = ((now - start) % period + period) % period;
  return elapsed < failFor ? "failing" : "healthy";
}

export function featureCount(fault: FaultSlice, now = Date.now()): number {
  return nex28Phase(fault, now) === "failing" ? FEATURES_OVER_LIMIT : FEATURES_HEALTHY;
}

export async function fetchFaults(baseUrl: string): Promise<FaultState> {
  const response = await fetch(`${baseUrl}/control/state`);
  if (!response.ok) {
    throw new Error(`fault state ${response.status}`);
  }
  return (await response.json()) as FaultState;
}
