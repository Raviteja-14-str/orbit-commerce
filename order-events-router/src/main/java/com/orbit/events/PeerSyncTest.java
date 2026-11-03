// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

public final class PeerSyncTest {
    public static void main(String[] args) {
        PeerSync sync = new PeerSync();
        int at48 = sync.projectedThreads(48);
        int at88 = sync.projectedThreads(88);
        if (at48 >= NprocLimit.NPROC) {
            throw new AssertionError("48 peers should fit under nproc, got " + at48);
        }
        if (at48 < 17_000 || at48 > 18_000) {
            throw new AssertionError("48 peers should be ~17400 threads, got " + at48);
        }
        if (at88 < 30_000) {
            throw new AssertionError("88 peers should approach the nproc cap, got " + at88);
        }
        Membership ok = sync.connect(2, 10, name -> { }, "07:35:12.661Z");
        if (!ok.complete() || ok.threadsCreated != 720) {
            throw new AssertionError("expected 720 threads, got " + ok.threadsCreated);
        }
        Membership failed = sync.connect(4, 1204, name -> {
            throw new OutOfMemoryError("unable to create native thread");
        }, "07:35:12.661Z");
        if (failed.complete()) {
            throw new AssertionError("membership should be incomplete");
        }
        if (!failed.log.contains("java.lang.OutOfMemoryError: unable to create native thread: possibly out of memory or process/resource limits reached")) {
            throw new AssertionError(failed.log);
        }
        if (!failed.log.contains("peers_connected=0/4")) {
            throw new AssertionError(failed.log);
        }
        if (!failed.log.contains("dropping 1,204 routes")) {
            throw new AssertionError(failed.log);
        }
        WebhookDelivery hooks = new WebhookDelivery();
        if (!"webhook.deliver retry".equals(hooks.deliver(429))) {
            throw new AssertionError("4.9.0 should retry HTTP 429");
        }
        if (hooks.attemptsFor(429, 1) != 2) {
            throw new AssertionError("429 should schedule another attempt");
        }
        System.out.println("PeerSyncTest ok");
    }
}
