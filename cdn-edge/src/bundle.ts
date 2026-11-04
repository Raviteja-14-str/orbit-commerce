// Synthetic demo code for Nexus Intelligence. Not a real system.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WafRule } from "./waf.ts";

const here = dirname(fileURLToPath(import.meta.url));

/** edge-rules bundle pushed on the fast path to every PoP. No canary. */
export const RULES_BUNDLE = "2026.11.04-r3";

/** Global fast-path. A bad expression reaches all 40 PoPs in one push. */
export const ROLLOUT = { mode: "fast-path", pops: 40, canary: false };

export function readPattern(relativePath: string): string {
  const raw = readFileSync(join(here, "..", relativePath), "utf8");
  const line = raw
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !entry.startsWith("#"))
    .at(-1);
  return line ?? "";
}

const credentialStuffing = readPattern("rules/2026.11.04-r3/ORB-WAF-1187.pattern");

export const rules: WafRule[] = [
  { id: "ORB-WAF-1001", mode: "block", expression: "union\\s+select" },
  { id: "ORB-WAF-1187", mode: "simulate", expression: credentialStuffing },
];
