/* Synthetic demo code for Nexus Intelligence. Not a real system. */
#include "libedgeregex.h"

#include <string.h>

/* Continuation-passing backtracker.
   eval() returns 1 if the continuation accepts, 0 if this pattern does not
   match, and -1 when the step budget is exhausted. Quantifiers try the
   greedy length first and then shorter ones, which is the re_backtrack_match
   path the edge CPU profiles point at. */

typedef struct Cont {
    int (*fn)(struct Cont *self, const char *text, int *steps, int budget);
} Cont;

static int bump(int *steps, int budget) {
    if (*steps >= budget) {
        return -1;
    }
    *steps += 1;
    return 0;
}

static const char *scan_group_end(const char *p, const char *end) {
    int depth = 1;
    while (p < end) {
        if (*p == '\\' && p + 1 < end) {
            p += 2;
            continue;
        }
        if (*p == '[') {
            p++;
            if (p < end && *p == '^') {
                p++;
            }
            while (p < end && *p != ']') {
                if (*p == '\\' && p + 1 < end) {
                    p += 2;
                } else {
                    p++;
                }
            }
            if (p < end) {
                p++;
            }
            continue;
        }
        if (*p == '(') {
            depth++;
        } else if (*p == ')') {
            depth--;
            if (depth == 0) {
                return p;
            }
        }
        p++;
    }
    return end;
}

static int has_top_alt(const char *p, const char *end) {
    int depth = 0;
    while (p < end) {
        if (*p == '\\' && p + 1 < end) {
            p += 2;
            continue;
        }
        if (*p == '[') {
            p++;
            while (p < end && *p != ']') {
                if (*p == '\\' && p + 1 < end) {
                    p += 2;
                } else {
                    p++;
                }
            }
            if (p < end) {
                p++;
            }
            continue;
        }
        if (*p == '(') {
            depth++;
        } else if (*p == ')' && depth > 0) {
            depth--;
        } else if (*p == '|' && depth == 0) {
            return 1;
        }
        p++;
    }
    return 0;
}

static int class_match(const char *cls, const char *cls_end, char ch) {
    int neg = 0;
    if (cls < cls_end && *cls == '^') {
        neg = 1;
        cls++;
    }
    int found = 0;
    while (cls < cls_end) {
        if (*cls == '\\' && cls + 1 < cls_end) {
            cls++;
            if (*cls == 'd') {
                found = found || (ch >= '0' && ch <= '9');
            } else if (*cls == 's') {
                found = found || (ch == ' ' || ch == '\t' || ch == '\n');
            } else if (*cls == ch) {
                found = 1;
            }
        } else if (cls + 2 < cls_end && cls[1] == '-') {
            if (ch >= cls[0] && ch <= cls[2]) {
                found = 1;
            }
            cls += 2;
        } else if (*cls == ch) {
            found = 1;
        }
        cls++;
    }
    return neg ? !found : found;
}

static int eval(const char *p, const char *end, const char *text, Cont *cont, int *steps, int budget);
static int eval_repeat(const char *body, const char *body_end, const char *rest, const char *rest_end,
                       int min_rep, int max_rep, int have, const char *text, Cont *outer, int *steps, int budget);
static int eval_char_repeat(const char *atom, int atom_bytes, const char *rest, const char *rest_end,
                            int min_rep, int max_rep, int have, const char *text, Cont *outer, int *steps, int budget);

typedef struct {
    Cont base;
    const char *body;
    const char *body_end;
    const char *rest;
    const char *rest_end;
    int min_rep;
    int max_rep;
    int have;
    const char *started;
    Cont *outer;
} Rep;

static int rep_fn(Cont *self, const char *text, int *steps, int budget) {
    Rep *r = (Rep *)self;
    if (text == r->started) {
        /* Empty iteration: do not recurse. Accept the rest if min is already met. */
        if (r->have - 1 >= r->min_rep) {
            return eval(r->rest, r->rest_end, text, r->outer, steps, budget);
        }
        return 0;
    }
    return eval_repeat(r->body, r->body_end, r->rest, r->rest_end, r->min_rep, r->max_rep, r->have, text,
                       r->outer, steps, budget);
}

static int eval_repeat(const char *body, const char *body_end, const char *rest, const char *rest_end,
                       int min_rep, int max_rep, int have, const char *text, Cont *outer, int *steps, int budget) {
    int rc = bump(steps, budget);
    if (rc != 0) {
        return rc;
    }
    if (have < max_rep) {
        Rep again;
        again.base.fn = rep_fn;
        again.body = body;
        again.body_end = body_end;
        again.rest = rest;
        again.rest_end = rest_end;
        again.min_rep = min_rep;
        again.max_rep = max_rep;
        again.have = have + 1;
        again.started = text;
        again.outer = outer;
        rc = eval(body, body_end, text, (Cont *)&again, steps, budget);
        if (rc != 0) {
            return rc;
        }
    }
    if (have >= min_rep) {
        return eval(rest, rest_end, text, outer, steps, budget);
    }
    return 0;
}

static int atom_ok(const char *p, const char *atom_end, char ch, int *atom_bytes) {
    if (p >= atom_end) {
        return 0;
    }
    if (*p == '.') {
        *atom_bytes = 1;
        return ch != '\0';
    }
    if (*p == '\\' && p + 1 < atom_end) {
        *atom_bytes = 2;
        if (p[1] == 'd') {
            return ch >= '0' && ch <= '9';
        }
        if (p[1] == 's') {
            return ch == ' ' || ch == '\t' || ch == '\n';
        }
        return ch == p[1];
    }
    if (*p == '[') {
        const char *cls_end = p + 1;
        while (cls_end < atom_end && *cls_end != ']') {
            if (*cls_end == '\\' && cls_end + 1 < atom_end) {
                cls_end += 2;
            } else {
                cls_end++;
            }
        }
        *atom_bytes = (int)((cls_end < atom_end ? cls_end + 1 : cls_end) - p);
        if (ch == '\0') {
            return 0;
        }
        return class_match(p + 1, cls_end, ch);
    }
    *atom_bytes = 1;
    return ch != '\0' && ch == *p;
}

static int eval(const char *p, const char *end, const char *text, Cont *cont, int *steps, int budget) {
    int rc = bump(steps, budget);
    if (rc != 0) {
        return rc;
    }
    if (p >= end) {
        return cont->fn(cont, text, steps, budget);
    }
    if (has_top_alt(p, end)) {
        const char *seg = p;
        int depth = 0;
        const char *cur = p;
        while (cur <= end) {
            int at_bar = 0;
            if (cur == end) {
                at_bar = 1;
            } else if (*cur == '\\' && cur + 1 < end) {
                cur += 2;
                continue;
            } else if (*cur == '[') {
                cur++;
                while (cur < end && *cur != ']') {
                    if (*cur == '\\' && cur + 1 < end) {
                        cur += 2;
                    } else {
                        cur++;
                    }
                }
                if (cur < end) {
                    cur++;
                }
                continue;
            } else if (*cur == '(') {
                depth++;
            } else if (*cur == ')' && depth > 0) {
                depth--;
            } else if (*cur == '|' && depth == 0) {
                at_bar = 1;
            }
            if (!at_bar) {
                cur++;
                continue;
            }
            rc = eval(seg, cur, text, cont, steps, budget);
            if (rc != 0) {
                return rc;
            }
            if (cur == end) {
                break;
            }
            cur++;
            seg = cur;
        }
        return 0;
    }

    if (*p == '(') {
        const char *body = p + 1;
        if (body + 1 < end && body[0] == '?' && body[1] == ':') {
            body += 2;
        }
        const char *close = scan_group_end(body, end);
        const char *after = (close < end && *close == ')') ? close + 1 : close;
        int min_rep = 1;
        int max_rep = 1;
        if (after < end && (*after == '*' || *after == '+' || *after == '?')) {
            if (*after == '*') {
                min_rep = 0;
                max_rep = 64;
            } else if (*after == '+') {
                min_rep = 1;
                max_rep = 64;
            } else {
                min_rep = 0;
                max_rep = 1;
            }
            after++;
        }
        return eval_repeat(body, close, after, end, min_rep, max_rep, 0, text, cont, steps, budget);
    }

    int atom_bytes = 1;
    /* Peek quantifier after the atom. atom_ok also reports the width for a concrete char;
       compute width without consuming text. */
    if (*p == '\\' && p + 1 < end) {
        atom_bytes = 2;
    } else if (*p == '[') {
        const char *q = p + 1;
        while (q < end && *q != ']') {
            if (*q == '\\' && q + 1 < end) {
                q += 2;
            } else {
                q++;
            }
        }
        atom_bytes = (int)((q < end ? q + 1 : q) - p);
    } else {
        atom_bytes = 1;
    }
    const char *after = p + atom_bytes;
    int min_rep = 1;
    int max_rep = 1;
    if (after < end && (*after == '*' || *after == '+' || *after == '?')) {
        if (*after == '*') {
            min_rep = 0;
            max_rep = 256;
        } else if (*after == '+') {
            min_rep = 1;
            max_rep = 256;
        } else {
            min_rep = 0;
            max_rep = 1;
        }
        after++;
    }

    /* Character atoms are their own one-char body. Reuse eval_repeat by matching
       a single character via a tiny dedicated loop to avoid re-parsing. */
    return eval_char_repeat(p, atom_bytes, after, end, min_rep, max_rep, 0, text, cont, steps, budget);
}

static int eval_char_repeat(const char *atom, int atom_bytes, const char *rest, const char *rest_end,
                            int min_rep, int max_rep, int have, const char *text, Cont *outer,
                            int *steps, int budget) {
    int rc = bump(steps, budget);
    if (rc != 0) {
        return rc;
    }
    if (have < max_rep && *text != '\0') {
        int width = 0;
        if (atom_ok(atom, atom + atom_bytes, *text, &width)) {
            rc = eval_char_repeat(atom, atom_bytes, rest, rest_end, min_rep, max_rep, have + 1, text + 1, outer, steps, budget);
            if (rc != 0) {
                return rc;
            }
        }
    }
    if (have >= min_rep) {
        return eval(rest, rest_end, text, outer, steps, budget);
    }
    return 0;
}

static int succeed(Cont *self, const char *text, int *steps, int budget) {
    (void)self;
    (void)text;
    (void)steps;
    (void)budget;
    return 1;
}

int re_backtrack_match(const char *pattern, const char *text, int step_budget, int *steps_out) {
    int steps = 0;
    Cont ok;
    ok.fn = succeed;
    if (pattern == NULL || text == NULL || step_budget < 0) {
        if (steps_out) {
            *steps_out = 0;
        }
        return 0;
    }
    const char *t = text;
    size_t plen = strlen(pattern);
    for (;;) {
        int rc = eval(pattern, pattern + plen, t, &ok, &steps, step_budget);
        if (rc == -1) {
            if (steps_out) {
                *steps_out = steps;
            }
            return -1;
        }
        if (rc == 1) {
            if (steps_out) {
                *steps_out = steps;
            }
            return 1;
        }
        if (*t == '\0') {
            break;
        }
        t++;
    }
    if (steps_out) {
        *steps_out = steps;
    }
    return 0;
}
