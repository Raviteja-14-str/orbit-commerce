// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

/**
 * pricing-service 4.17.0. Prices are a base amount plus a regional adjustment.
 * Promo policy v2 is not in this version.
 */
public final class PriceEngine {
    public Quote quote(String sku, String region) {
        long amount = 2_500L;
        if ("eu-west".equals(region)) {
            amount += 80L;
        } else if ("ap-south".equals(region)) {
            amount += 40L;
        }
        return new Quote(sku, amount);
    }
}
