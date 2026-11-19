// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface CartLine {
  sku: string;
  qty: number;
}

export interface Totals {
  spans: string[];
  totalMinor?: number;
  error?: "Price unavailable";
}

/** cart.get_totals calls pricing.quote once per line. */
export function getTotals(lines: CartLine[], quote: (sku: string) => number | null): Totals {
  const spans = ["cart.get_totals", "pricing.quote"];
  let totalMinor = 0;
  for (const line of lines) {
    const price = quote(line.sku);
    if (price == null) {
      return { spans, error: "Price unavailable" };
    }
    totalMinor += price * line.qty;
  }
  return { spans, totalMinor };
}
