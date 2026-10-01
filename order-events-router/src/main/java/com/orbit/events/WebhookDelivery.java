// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

/** 4.8.0 delivers once. Retry on HTTP 429 is added in 4.9.0. */
public final class WebhookDelivery {
    public String deliver(int status) {
        if (status >= 500) {
            return "webhook.deliver failed";
        }
        return "webhook.deliver ok";
    }
}
