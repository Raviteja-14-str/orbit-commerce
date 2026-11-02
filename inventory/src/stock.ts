// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface StockRow {
  sku: string;
  onHand: number;
}

/**
 * stock-sync 6.2.4 writes rows in batches. The on-hand value is still the
 * last row for that sku. Batching does not zero stock and does not talk to DNS.
 */
export function syncStock(rows: StockRow[], batchSize = 100): Map<string, number> {
  const totals = new Map<string, number>();
  const size = batchSize > 0 ? batchSize : rows.length;
  for (let offset = 0; offset < rows.length; offset += size) {
    const batch = rows.slice(offset, offset + size);
    for (const row of batch) {
      totals.set(row.sku, row.onHand);
    }
  }
  return totals;
}

export function onHand(totals: Map<string, number>, sku: string): number {
  return totals.get(sku) ?? 0;
}
