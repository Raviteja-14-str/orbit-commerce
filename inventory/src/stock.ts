// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface StockRow {
  sku: string;
  onHand: number;
}

/** stock-sync applies each row. Batching changes later must keep the same totals. */
export function syncStock(rows: StockRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.sku, row.onHand);
  }
  return totals;
}

export function onHand(totals: Map<string, number>, sku: string): number {
  return totals.get(sku) ?? 0;
}
