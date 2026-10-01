// Synthetic demo code for Nexus Intelligence. Not a real system.

import type { WafRule } from "./waf.ts";

/** Baseline rules bundle. Managed-rule changes ship as a new bundle id. */
export const RULES_BUNDLE = "2026.10.01-r1";

/** Staged across PoPs. The fast-path (no canary) is not used by this bundle. */
export const ROLLOUT = { mode: "staged", pops: 40, canary: true };

export const rules: WafRule[] = [
  { id: "ORB-WAF-1001", mode: "block", expression: "union\\s+select" },
];
