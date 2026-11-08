// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Product {
  sku: string;
  title: string;
  merchant: string;
  /** catalog 2.77.0 product attributes. Pricing regional caps do not read this. */
  attributes?: Record<string, string>;
}

export function getProduct(products: Product[], sku: string): Product | null {
  return products.find((p) => p.sku === sku) ?? null;
}
