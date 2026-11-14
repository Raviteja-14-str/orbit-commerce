// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

import java.util.Map;

/**
 * Contract unit prices for the live storefront, in minor units.
 * Unknown SKUs, including the SKU-1 fixture, stay at 2500.
 */
public final class LivePriceBook {
    private static final Map<String, Long> PRICES = Map.ofEntries(
            Map.entry("SKU-HAMMER", 1_899L),
            Map.entry("SKU-DRILL", 12_900L),
            Map.entry("SKU-SAW", 14_900L),
            Map.entry("SKU-IMPACT", 9_900L),
            Map.entry("SKU-LAMP", 3_499L),
            Map.entry("SKU-WRENCH", 4_299L),
            Map.entry("SKU-PLIERS", 1_699L),
            Map.entry("SKU-DRIVER", 2_899L),
            Map.entry("SKU-KNIFE", 899L),
            Map.entry("SKU-LEVEL", 2_499L),
            Map.entry("SKU-TAPE", 1_499L),
            Map.entry("SKU-BULB", 1_899L),
            Map.entry("SKU-PENDANT", 7_900L),
            Map.entry("SKU-SCONCE", 5_400L),
            Map.entry("SKU-FAUCET", 8_900L),
            Map.entry("SKU-PIPE", 1_299L),
            Map.entry("SKU-HOSE", 1_999L),
            Map.entry("SKU-SHOVEL", 2_799L),
            Map.entry("SKU-MOWER", 29_900L),
            Map.entry("SKU-KIT", 2_199L),
            Map.entry("SKU-NAILS", 3_299L),
            Map.entry("SKU-ANCHOR", 999L),
            Map.entry("SKU-GLASSES", 1_299L),
            Map.entry("SKU-GLOVES", 1_899L),
            Map.entry("SKU-HAT", 2_199L),
            Map.entry("SKU-BOX", 3_999L),
            Map.entry("SKU-SHELF", 8_900L),
            Map.entry("SKU-LADDER", 6_900L),
            Map.entry("SKU-BRUSH", 1_299L),
            Map.entry("SKU-ROLLER", 1_499L)
    );

    private LivePriceBook() {}

    public static long amount(String sku) {
        Long price = PRICES.get(sku);
        return price == null ? 2_500L : price.longValue();
    }
}
