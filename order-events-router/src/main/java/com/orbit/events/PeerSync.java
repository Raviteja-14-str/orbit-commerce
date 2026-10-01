// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

/**
 * Peer sync keeps a thread pool per router peer. Thread count scales linearly
 * with the number of order-events-router nodes. At 48 peers this is about
 * 17k threads. At 88 peers it sits on the orbit-node nproc limit (32768)
 * and Thread.start throws OutOfMemoryError even when the Java heap is only
 * about half used. The message says "out of memory"; the resource is threads.
 */
public final class PeerSync {
    /** ~360 native threads opened for every connected peer. */
    public static final int THREADS_PER_PEER = 360;

    public int projectedThreads(int peers) {
        return peers * THREADS_PER_PEER;
    }

    public Membership connect(int peersExpected, int pendingRoutes, ThreadStarter starter, String ts) {
        int connected = 0;
        int created = 0;
        String log = "";
        for (int peer = 0; peer < peersExpected; peer++) {
            try {
                for (int i = 0; i < THREADS_PER_PEER; i++) {
                    starter.start("peer-" + peer + "-t" + i);
                    created++;
                }
                connected++;
            } catch (OutOfMemoryError error) {
                log = RouterLog.oom(ts);
                break;
            }
        }
        int dropped = 0;
        if (connected < peersExpected) {
            dropped = pendingRoutes;
            String stale = RouterLog.staleMembership(ts, connected, peersExpected, dropped);
            log = log.isEmpty() ? stale : log + "\n" + stale;
        }
        return new Membership(connected, peersExpected, created, dropped, log);
    }
}
