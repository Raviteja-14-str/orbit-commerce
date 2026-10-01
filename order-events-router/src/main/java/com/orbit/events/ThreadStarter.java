// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

/** Production implementation calls Thread.start(). pthread_create failure surfaces as OutOfMemoryError. */
public interface ThreadStarter {
    void start(String name);
}
