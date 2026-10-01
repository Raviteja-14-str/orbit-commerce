// Synthetic demo code for Nexus Intelligence. Not a real system.

/** Wall-clock budget for one WAF rule evaluation. Exceeding it returns 502. */
export const WAF_EVAL_BUDGET_MS = 30_000;

export interface WafRule {
  id: string;
  /** simulate still runs the regex; it only suppresses the block action. */
  mode: "simulate" | "block" | "off";
  expression: string;
}

export interface MatchResult {
  /** 1 match, 0 no match, -1 step budget exhausted inside re_backtrack_match. */
  code: number;
  steps: number;
}

/** Same contract as re_backtrack_match in libedgeregex.so. */
export type Matcher = (pattern: string, text: string, stepBudget: number) => MatchResult;

export interface EvalInput {
  host: string;
  path: string;
  body: string;
  worker: number;
}

export interface EvalDeps {
  matcher: Matcher;
  /** Milliseconds. Called before and after the matcher. */
  clock: () => number;
  budgetMs: number;
}

export interface EvalOutcome {
  status: number;
  upstream: "none" | "origin";
  logs: string[];
}

export function formatWafTimeout(ts: string, worker: number, elapsedMs: number, host: string): string {
  return `${ts} WARN  worker=${worker} request_timeout upstream=none phase=waf_eval elapsed_ms=${elapsedMs} host=${host}`;
}

export function formatWaf502(ts: string, worker: number, ruleId: string, mode: string): string {
  return `${ts} ERROR worker=${worker} 502 sent: waf evaluation exceeded budget rule_id=${ruleId} mode=${mode}`;
}

/**
 * Evaluate every enabled rule, including mode=simulate.
 * Simulate is log-only for the block action. It does not skip
 * re_backtrack_match, so a catastrophic expression still consumes the budget
 * and the proxy returns 502 with upstream=none.
 */
export function evaluateRules(rules: WafRule[], input: EvalInput, deps: EvalDeps, ts: string): EvalOutcome {
  const logs: string[] = [];
  const haystack = `${input.path}\n${input.body}`;
  for (const rule of rules) {
    if (rule.mode === "off") {
      continue;
    }
    const started = deps.clock();
    const matched = deps.matcher(rule.expression, haystack, 1_000_000);
    const elapsed = deps.clock() - started;
    const exhausted = matched.code === -1 || elapsed >= deps.budgetMs;
    if (exhausted) {
      const elapsedMs = elapsed >= deps.budgetMs ? elapsed : deps.budgetMs;
      logs.push(formatWafTimeout(ts, input.worker, elapsedMs, input.host));
      logs.push(formatWaf502(ts, input.worker, rule.id, rule.mode));
      return { status: 502, upstream: "none", logs };
    }
    if (matched.code === 1 && rule.mode === "block") {
      return { status: 403, upstream: "none", logs };
    }
  }
  return { status: 200, upstream: "origin", logs };
}
