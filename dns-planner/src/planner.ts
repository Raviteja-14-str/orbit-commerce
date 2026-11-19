// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface DesiredPlan {
  gen: number;
  endpoints: Record<string, string[]>;
}

/** dns-planner 1.8.1. Each plan is a full desired snapshot with a monotonic generation. */
export function nextPlan(previousGen: number, endpoints: Record<string, string[]>): DesiredPlan {
  return { gen: previousGen + 1, endpoints };
}
