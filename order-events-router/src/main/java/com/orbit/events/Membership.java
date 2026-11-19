// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

public final class Membership {
    public final int peersConnected;
    public final int peersExpected;
    public final int threadsCreated;
    public final int droppedRoutes;
    public final String log;

    public Membership(int peersConnected, int peersExpected, int threadsCreated, int droppedRoutes, String log) {
        this.peersConnected = peersConnected;
        this.peersExpected = peersExpected;
        this.threadsCreated = threadsCreated;
        this.droppedRoutes = droppedRoutes;
        this.log = log;
    }

    public boolean complete() {
        return peersConnected == peersExpected;
    }
}
