// Synthetic demo code for Nexus Intelligence. Not a real system.

import { getTotals, type CartLine } from "../../cart/src/cart.ts";
import { reserveStock, type DnsLookup } from "./reserve-stock.ts";

export interface PlaceOrderInput {
  cart: CartLine[];
  onHand: number;
  lookup: DnsLookup;
  paymentApproved: boolean;
  ts: string;
  traceId: string;
}

export interface PlaceOrderResult {
  spans: string[];
  status: "placed" | "OUT_OF_STOCK" | "Price unavailable" | "payment_failed";
  log?: string;
}

/**
 * checkout.place_order -> pricing.quote -> inventory reserve -> payments.authorize
 * -> order.created -> router.fanout -> webhook.deliver
 */
export function placeOrder(input: PlaceOrderInput, quote: (sku: string) => number | null): PlaceOrderResult {
  const spans = ["checkout.place_order"];
  const totals = getTotals(input.cart, quote);
  spans.push(...totals.spans.filter((s) => s !== "cart.get_totals"));
  if (totals.error) {
    return { spans, status: "Price unavailable" };
  }
  const reserved = reserveStock(input.lookup, input.onHand, input.ts, input.traceId);
  if (reserved.status !== "reserved") {
    return { spans, status: "OUT_OF_STOCK", log: reserved.log };
  }
  spans.push("payments.authorize", "risk.score");
  if (!input.paymentApproved) {
    return { spans, status: "payment_failed" };
  }
  spans.push("order.created", "router.fanout", "webhook.deliver");
  return { spans, status: "placed" };
}
