// Synthetic demo code for Nexus Intelligence. Not a real system.
package com.orbit.events;

/** 4.9.0 retries a merchant endpoint that returns 429. Peer threads are unchanged. */
public final class WebhookDelivery {
    public int attemptsFor(int status, int attempt) {
        if (status == 429 && attempt < 5) {
            return attempt + 1;
        }
        return attempt;
    }

    public String deliver(int status) {
        if (status >= 500) {
            return "webhook.deliver failed";
        }
        if (status == 429) {
            return "webhook.deliver retry";
        }
        return "webhook.deliver ok";
    }
}
