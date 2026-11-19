// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

import java.util.Properties;

/** Kill switch for promo policy v2. Default true. Not a staged feature flag. */
public final class PricingConfig {
    public static final String PROMO_V2_ENABLED = "pricing.promo_v2.enabled";

    private PricingConfig() {}

    public static boolean promoV2Enabled(Properties properties) {
        String raw = properties.getProperty(PROMO_V2_ENABLED, "true");
        return !"false".equalsIgnoreCase(raw.trim());
    }
}
