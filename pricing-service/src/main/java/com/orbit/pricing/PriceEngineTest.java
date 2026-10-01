// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

public final class PriceEngineTest {
    public static void main(String[] args) {
        PriceEngine engine = new PriceEngine();
        Quote quote = engine.quote("SKU-1", "us-east");
        if (quote.amountMinor != 2500L) {
            throw new AssertionError("unexpected price " + quote.amountMinor);
        }
        System.out.println("PriceEngineTest ok");
    }
}
