/* Synthetic demo code for Nexus Intelligence. Not a real system. */
#include "libedgeregex.h"

#include <stdio.h>

static int expect(const char *pat, const char *text, int budget, int want) {
    int steps = 0;
    int rc = re_backtrack_match(pat, text, budget, &steps);
    if (rc != want) {
        fprintf(stderr, "pattern '%s' text '%s' -> %d (steps %d), want %d\n", pat, text, rc, steps, want);
        return 1;
    }
    return 0;
}

int main(void) {
    int failed = 0;
    failed += expect("abc", "zzabczz", 1000, 1);
    failed += expect("a.*c", "abbbc", 10000, 1);
    failed += expect("xyz", "abc", 1000, 0);
    failed += expect("(?:ab)+c", "ababc", 5000, 1);
    failed += expect("a|b", "zb", 1000, 1);
    failed += expect("[0-9]+", "id-42", 1000, 1);
    failed += expect("\\d+", "id-42", 1000, 1);
    /* Nested quantifiers exhaust a small step budget instead of hanging. */
    failed += expect("(a+)+b", "aaaaaaaaaaaa", 80, -1);
    return failed == 0 ? 0 : 1;
}
