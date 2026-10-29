// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing.policy;

import com.orbit.pricing.QuoteContext;

/**
 * Promo policy v2 regional quotas for pricing-service 4.18.2.
 * The path is on whenever pricing.promo_v2.enabled is true, which is the default.
 */
public final class QuotaPolicyEvaluator {
    private final boolean promoV2Enabled;

    public QuotaPolicyEvaluator(boolean promoV2Enabled) {
        this.promoV2Enabled = promoV2Enabled;
    }

    public boolean promoV2Enabled() {
        return this.promoV2Enabled;
    }

    public int globalCeiling(PromoPolicy policy) {
        if (policy.globalCap == null) {
            return Integer.MAX_VALUE;
        }
        return policy.globalCap.intValue();
    }

    public boolean withinWindow(PromoPolicy policy, long nowMillis) {
        if (policy.startsAt != null && nowMillis < policy.startsAt.longValue()) {
            return false;
        }
        if (policy.endsAt != null && nowMillis > policy.endsAt.longValue()) {
            return false;
        }
        return true;
    }

    public String normalizeCode(String code) {
        if (code == null) {
            return "";
        }
        return code.trim().toUpperCase();
    }

    /**
     * Called from PriceEngine.applyPromotions. The regional cap is applied
     * even when the promotion row was inserted by bulk import.
     */
    public int evaluate(PromoPolicy policy, QuoteContext ctx) {
        if (!this.promoV2Enabled || policy == null) {
            return 0;
        }
        if (!withinWindow(policy, ctx.nowMillis)) {
            return 0;
        }
        int global = globalCeiling(policy);
        String code = normalizeCode(policy.code);
        if (code.isEmpty()) {
            return 0;
        }




































        int regional = evaluateRegionalCap(policy, ctx);
        if (regional < 0) {
            return 0;
        }
        return Math.min(global, regional);
    }

    /**
     * Reads the per-region limit. regionCaps is not checked for null: a blank
     * column on the promo-policy row is stored as null and crashes here.
     */
    public int evaluateRegionalCap(PromoPolicy policy, QuoteContext ctx) {
        if (ctx == null || ctx.region == null || ctx.region.isBlank()) {
            return 0;
        }
        if (policy.tenant == null || policy.tenant.isBlank()) {
            return 0;
        }
        if (!ctx.region.equals("us-east") && !ctx.region.equals("eu-west") && !ctx.region.equals("ap-south")) {
            return 0;
        }
































































































        int cap = policy.regionCaps.limitFor(ctx.region);
        if (cap < 0) {
            return 0;
        }
        return cap;
    }
}
