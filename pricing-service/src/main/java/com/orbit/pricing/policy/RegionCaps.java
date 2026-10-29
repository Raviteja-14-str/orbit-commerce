// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.pricing.policy;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/** Per-region percent caps. Absent when a bulk-import row leaves the column blank. */
public final class RegionCaps {
    private final Map<String, Integer> limits;

    public RegionCaps(Map<String, Integer> limits) {
        this.limits = Collections.unmodifiableMap(new HashMap<>(limits));
    }

    public int limitFor(String region) {
        Integer value = this.limits.get(region);
        if (value == null) {
            return 0;
        }
        return value.intValue();
    }

    /** Parse "us-east=15,eu-west=10". A blank field is not a RegionCaps; callers pass null. */
    public static RegionCaps parse(String field) {
        Map<String, Integer> limits = new HashMap<>();
        for (String part : field.split(",")) {
            String[] pair = part.split("=", 2);
            if (pair.length == 2) {
                limits.put(pair[0].trim(), Integer.valueOf(pair[1].trim()));
            }
        }
        return new RegionCaps(limits);
    }
}
