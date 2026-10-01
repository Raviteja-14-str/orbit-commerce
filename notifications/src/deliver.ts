// Synthetic demo code for Nexus Intelligence. Not a real system.

/** Confirmation email and merchant webhook. Both wait on router.fanout. */
export function deliverEmail(orderId: string): { channel: "email"; orderId: string } {
  return { channel: "email", orderId };
}

export function deliverWebhook(orderId: string): { span: "webhook.deliver"; orderId: string } {
  return { span: "webhook.deliver", orderId };
}
