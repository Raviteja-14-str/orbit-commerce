// Synthetic demo code for Nexus Intelligence. Not a real system.

import { listen, readBody, sendJson } from "../lib/http.ts";

const port = Number(process.env.PORT ?? 4410);

interface Cart {
  id: string;
  tenant: string;
  lines: { sku: string; qty: number }[];
}

const carts = new Map<string, Cart>();
let sequence = 1;

listen(port, async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "cart" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/v1/carts") {
    const body = JSON.parse(await readBody(req)) as { tenant?: string };
    const cart: Cart = { id: `cart-${sequence}`, tenant: body.tenant ?? "t_brightline", lines: [] };
    sequence += 1;
    carts.set(cart.id, cart);
    sendJson(res, 201, cart);
    return;
  }
  const itemMatch = url.pathname.match(/^\/v1\/carts\/([^/]+)\/items$/);
  if (req.method === "POST" && itemMatch) {
    const cart = carts.get(itemMatch[1]);
    if (!cart) {
      sendJson(res, 404, { error: "cart not found" });
      return;
    }
    const body = JSON.parse(await readBody(req)) as { sku?: string; qty?: number };
    if (!body.sku) {
      sendJson(res, 400, { error: "sku required" });
      return;
    }
    const qty = body.qty && body.qty > 0 ? body.qty : 1;
    const existing = cart.lines.find((line) => line.sku === body.sku);
    if (existing) {
      existing.qty += qty;
    } else {
      cart.lines.push({ sku: body.sku, qty });
    }
    sendJson(res, 200, cart);
    return;
  }
  const cartMatch = url.pathname.match(/^\/v1\/carts\/([^/]+)$/);
  if (req.method === "GET" && cartMatch) {
    const cart = carts.get(cartMatch[1]);
    if (!cart) {
      sendJson(res, 404, { error: "cart not found" });
      return;
    }
    sendJson(res, 200, cart);
    return;
  }
  sendJson(res, 404, { error: "not found" });
});
