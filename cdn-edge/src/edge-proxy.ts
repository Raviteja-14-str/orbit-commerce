// Synthetic demo code for Nexus Intelligence. Not a real system.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateRules, type EvalDeps, type EvalInput, type WafRule } from "./waf.ts";

const here = dirname(fileURLToPath(import.meta.url));

export function edgeProxyVersion(): string {
  const raw = readFileSync(join(here, "..", "VERSION"), "utf8");
  const line = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).at(-1);
  return line ?? "unknown";
}

export interface ProxyRequest {
  host: string;
  path: string;
  body: string;
  worker: number;
}

/** edge-proxy process. WAF runs before any origin connection. */
export function handleProxyRequest(rules: WafRule[], request: ProxyRequest, deps: EvalDeps, ts: string) {
  const input: EvalInput = {
    host: request.host,
    path: request.path,
    body: request.body,
    worker: request.worker,
  };
  const outcome = evaluateRules(rules, input, deps, ts);
  return {
    version: edgeProxyVersion(),
    status: outcome.status,
    upstream: outcome.upstream,
    logs: outcome.logs,
  };
}
