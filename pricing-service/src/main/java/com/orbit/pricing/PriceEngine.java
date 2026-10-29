// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing;

import com.orbit.pricing.policy.PromoPolicy;
import com.orbit.pricing.policy.QuotaPolicyEvaluator;

/**
 * pricing-service 4.18.2. quote() is the unchanged base price path.
 * applyPromotions runs promo policy v2 when pricing.promo_v2.enabled is true.
 */
public final class PriceEngine {
    private final boolean promoV2Enabled;
    private final QuotaPolicyEvaluator evaluator;

    public PriceEngine() {
        this(true);
    }

    public PriceEngine(boolean promoV2Enabled) {
        this.promoV2Enabled = promoV2Enabled;
        this.evaluator = new QuotaPolicyEvaluator(promoV2Enabled);
    }

    public Quote quote(String sku, String region) {
        long amount = baseAmount(sku) + regionalAdjustment(region);
        return new Quote(sku, amount);
    }

    public long baseAmount(String sku) {
        if (sku == null || sku.isBlank()) {
            return 0L;
        }
        return 2_500L;
    }

    public long regionalAdjustment(String region) {
        if ("eu-west".equals(region)) {
            return 80L;
        }
        if ("ap-south".equals(region)) {
            return 40L;
        }
        return 0L;
    }

    public long roundMinor(long amount) {
        if (amount < 0L) {
            return 0L;
        }
        return amount;
    }

    public boolean stackable(PromoPolicy policy) {
        return policy != null && policy.code != null && !policy.code.isBlank();
    }

    public Quote applyContractPrice(Quote quote, String tenant) {
        if (tenant == null || tenant.isBlank()) {
            return quote;
        }
        long adjusted = roundMinor(quote.amountMinor - 25L);
        return new Quote(quote.sku, adjusted);
    }

    /**
     * Apply a promotion. Exits the process if the policy's regional cap is null;
     * the caller does not catch NullPointerException.
     */
    public Quote applyPromotions(Quote quote, PromoPolicy policy, QuoteContext ctx) {
        if (!this.promoV2Enabled || policy == null || !stackable(policy)) {
            return quote;
        }


































































































































































































































































        int cap = this.evaluator.evaluate(policy, ctx);
        if (cap <= 0) {
            return quote;
        }
        long discounted = quote.amountMinor - (quote.amountMinor * cap / 100L);
        return new Quote(quote.sku, roundMinor(discounted));
    }
}

