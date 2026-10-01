// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Product {
  sku: string;
  title: string;
  merchant: string;
}

/** catalog 2.76.0. Product attributes are a later schema (2.77.0). */
export function getProduct(products: Product[], sku: string): Product | null {
  return products.find((p) => p.sku === sku) ?? null;
}
