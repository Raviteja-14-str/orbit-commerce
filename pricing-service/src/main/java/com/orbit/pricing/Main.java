// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

/**
 * Process entry. An uncaught exception on a promo-eval thread ends the JVM.
 * The deployment restarts the pod immediately (no jitter), so a bad policy
 * restarts every replica at once and they reconnect to promo-policy-db together.
 */
public final class Main {
    private Main() {}

    public static String unhandledLine(String ts, String threadName) {
        return ts + " ERROR [" + threadName + "] Unhandled exception, exiting";
    }

    public static Thread promoThread(int index, Runnable task) {
        Thread thread = new Thread(task);
        thread.setName("promo-eval-" + index);
        return thread;
    }

    public static void installHandler() {
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            System.err.println(unhandledLine("unhandled", thread.getName()));
            error.printStackTrace(System.err);
            System.exit(1);
        });
    }
}
