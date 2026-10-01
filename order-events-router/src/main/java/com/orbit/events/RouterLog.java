// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

import java.util.Locale;

public final class RouterLog {
    private RouterLog() {}

    public static String oom(String ts) {
        return ts
                + " ERROR peer-sync java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached";
    }

    public static String staleMembership(String ts, int connected, int expected, int dropped) {
        String routes = String.format(Locale.US, "%,d", dropped);
        return ts
                + " WARN  membership map build incomplete peers_connected="
                + connected
                + "/"
                + expected
                + " -> routing table stale, dropping "
                + routes
                + " routes";
    }
}
