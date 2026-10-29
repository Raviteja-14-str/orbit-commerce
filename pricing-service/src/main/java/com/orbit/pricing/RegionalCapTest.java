// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

import com.orbit.pricing.policy.PromoPolicy;
import java.util.Properties;

public final class RegionalCapTest {
    public static void main(String[] args) {
        Properties properties = new Properties();
        properties.setProperty(PricingConfig.PROMO_V2_ENABLED, "true");
        if (!PricingConfig.promoV2Enabled(properties)) {
            throw new AssertionError("promo v2 should default on");
        }
        properties.setProperty(PricingConfig.PROMO_V2_ENABLED, "false");
        if (PricingConfig.promoV2Enabled(properties)) {
            throw new AssertionError("kill switch should disable promo v2");
        }

        String line = Main.unhandledLine("09:14:20.871Z", "promo-eval-4");
        String expected = "09:14:20.871Z ERROR [promo-eval-4] Unhandled exception, exiting";
        if (!expected.equals(line)) {
            throw new AssertionError(line);
        }

        PromoPolicy policy = PromoPolicy.fromBulkImport("pp_88f2", "WINTER-B2B-15", "t_kestrel", "");
        if (policy.regionCaps != null) {
            throw new AssertionError("blank region_caps must be null");
        }
        PriceEngine engine = new PriceEngine(true);
        Quote quote = engine.quote("SKU-1", "us-east");
        try {
            engine.applyPromotions(quote, policy, new QuoteContext("us-east", "t_kestrel", 0L));
            throw new AssertionError("expected NullPointerException");
        } catch (NullPointerException error) {
            String message = String.valueOf(error.getMessage());
            String needle = "Cannot invoke \"com.orbit.pricing.policy.RegionCaps.limitFor(String)\" because \"policy.regionCaps\" is null";
            if (!message.contains(needle)) {
                throw new AssertionError(message);
            }
            boolean sawCap = false;
            boolean sawEvaluate = false;
            boolean sawApply = false;
            for (StackTraceElement frame : error.getStackTrace()) {
                if ("evaluateRegionalCap".equals(frame.getMethodName())
                        && frame.getLineNumber() == 214
                        && "QuotaPolicyEvaluator.java".equals(frame.getFileName())) {
                    sawCap = true;
                }
                if ("evaluate".equals(frame.getMethodName())
                        && frame.getLineNumber() == 97
                        && "QuotaPolicyEvaluator.java".equals(frame.getFileName())) {
                    sawEvaluate = true;
                }
                if ("applyPromotions".equals(frame.getMethodName())
                        && frame.getLineNumber() == 331
                        && "PriceEngine.java".equals(frame.getFileName())) {
                    sawApply = true;
                }
            }
            if (!sawCap || !sawEvaluate || !sawApply) {
                error.printStackTrace();
                throw new AssertionError("stack frames did not match 214/97/331");
            }
        }

        PriceEngine disabled = new PriceEngine(false);
        Quote unchanged = disabled.applyPromotions(quote, policy, new QuoteContext("us-east", "t_kestrel", 0L));
        if (unchanged.amountMinor != quote.amountMinor) {
            throw new AssertionError("kill switch should skip promotions");
        }
        System.out.println("RegionalCapTest ok");
    }
}
