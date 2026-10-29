// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing.policy;

/**
 * One row from the replicated promo-policy store.
 * regionCaps is null when the source column was blank.
 */
public final class PromoPolicy {
    public final String id;
    public final String code;
    public final String tenant;
    public final RegionCaps regionCaps;
    public final Integer globalCap;
    public final Long startsAt;
    public final Long endsAt;
    public final String source;

    public PromoPolicy(
            String id,
            String code,
            String tenant,
            RegionCaps regionCaps,
            Integer globalCap,
            Long startsAt,
            Long endsAt,
            String source) {
        this.id = id;
        this.code = code;
        this.tenant = tenant;
        this.regionCaps = regionCaps;
        this.globalCap = globalCap;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.source = source;
    }

    /**
     * Bulk import. A blank or missing region_caps value is stored as null and
     * replicated to every region as-is. version 2 rows take the regional-cap path.
     */
    public static PromoPolicy fromBulkImport(String id, String code, String tenant, String regionCapsField) {
        RegionCaps caps = null;
        if (regionCapsField != null && !regionCapsField.isBlank()) {
            caps = RegionCaps.parse(regionCapsField);
        }
        return new PromoPolicy(id, code, tenant, caps, Integer.valueOf(15), null, null, "bulk_import");
    }
}
