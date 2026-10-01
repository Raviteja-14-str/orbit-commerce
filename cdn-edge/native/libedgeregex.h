/* Synthetic demo code for Nexus Intelligence. Not a real system. */
#ifndef ORBIT_LIBEDGEREGEX_H
#define ORBIT_LIBEDGEREGEX_H

/* Backtracking matcher linked by edge-proxy as libedgeregex.so.
   perf profiles attribute CPU to re_backtrack_match.
   Returns 1 match, 0 no match, -1 when step_budget is exhausted. */
int re_backtrack_match(const char *pattern, const char *text, int step_budget, int *steps_out);

#endif
