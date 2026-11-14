// Synthetic demo code for Nexus Intelligence. Not a real system.

const cartUrl = process.env.CART_URL ?? "http://127.0.0.1:4410";
const checkoutUrl = process.env.CHECKOUT_URL ?? "http://127.0.0.1:4412";
const intervalMs = Number(process.env.ORBIT_LOAD_INTERVAL_MS ?? 2000);
const skus = ["SKU-HAMMER", "SKU-LAMP", "SKU-KIT"];
let cursor = 0;

async function oneOrder(): Promise<void> {
  const created = await fetch(`${cartUrl}/v1/carts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tenant: "t_brightline" }),
  });
  if (!created.ok) {
    return;
  }
  const cart = (await created.json()) as { id: string };
  const sku = skus[cursor % skus.length];
  cursor += 1;
  const added = await fetch(`${cartUrl}/v1/carts/${cart.id}/items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sku, qty: 1 }),
  });
  if (!added.ok) {
    return;
  }
  await fetch(`${checkoutUrl}/v1/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cartId: cart.id }),
  });
}

setInterval(() => {
  void oneOrder().catch(() => undefined);
}, intervalMs);
console.log(`loadgen every ${intervalMs}ms`);
