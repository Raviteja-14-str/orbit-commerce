// Synthetic demo code for Nexus Intelligence. Not a real system.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** build_info{service=order-router} version label baked into the binary. */
export function buildInfo(): { service: "order-router"; version: string } {
  const raw = readFileSync(join(here, "..", "VERSION"), "utf8");
  const version = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .at(-1);
  return { service: "order-router", version: version ?? "unknown" };
}
