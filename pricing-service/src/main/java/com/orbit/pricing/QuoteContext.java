// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

public final class QuoteContext {
    public final String region;
    public final String tenant;
    public final long nowMillis;

    public QuoteContext(String region, String tenant, long nowMillis) {
        this.region = region;
        this.tenant = tenant;
        this.nowMillis = nowMillis;
    }
}
