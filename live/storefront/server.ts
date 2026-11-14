// Synthetic demo code for Nexus Intelligence. Not a real system.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listen, readBody, sendJson, sendText } from "../lib/http.ts";

const port = Number(process.env.PORT ?? 4401);
const cartUrl = process.env.CART_URL ?? "http://127.0.0.1:4410";
const checkoutUrl = process.env.CHECKOUT_URL ?? "http://127.0.0.1:4412";
const pricingUrl = process.env.PRICING_URL ?? "http://127.0.0.1:4411";
const observability = process.env.OBSERVABILITY_URL ?? "http://127.0.0.1:4400";
const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, "public");
const page = readFileSync(join(publicDir, "index.html"), "utf8");
const catalog = JSON.parse(readFileSync(join(publicDir, "catalog.json"), "utf8")) as {
  tenant: string;
  host: string;
  categories: unknown[];
  products: { sku: string; contractMinor: number }[];
};

const types: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function proxyJson(url: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: response.status, body };
}

function serveStatic(pathname: string, res: import("node:http").ServerResponse): boolean {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  if (decoded.includes("\0")) {
    return false;
  }
  const full = resolve(publicDir, `.${decoded}`);
  if (!full.startsWith(publicDir) || !existsSync(full) || !statSync(full).isFile()) {
    return false;
  }
  const body = readFileSync(full);
  const ext = extname(full);
  res.writeHead(200, {
    "content-type": types[ext] ?? "application/octet-stream",
    "content-length": body.length,
    "cache-control": ext === ".webp" ? "public, max-age=86400" : "no-cache",
  });
  res.end(body);
  return true;
}

listen(port, async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "storefront-web" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/favicon.ico") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/catalog") {
    const priced = [];
    for (const product of catalog.products) {
      const quote = await proxyJson(`${pricingUrl}/quote?sku=${encodeURIComponent(product.sku)}&region=us-east`);
      const amount = quote.status === 200 && quote.body && typeof quote.body === "object" && "amountMinor" in quote.body
        ? Number((quote.body as { amountMinor: number }).amountMinor)
        : product.contractMinor;
      priced.push({ ...product, amountMinor: amount });
    }
    sendJson(res, 200, { tenant: catalog.tenant, host: catalog.host, categories: catalog.categories, products: priced });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/carts") {
    const created = await proxyJson(`${cartUrl}/v1/carts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant: "t_brightline" }),
    });
    sendJson(res, created.status, created.body);
    return;
  }
  const itemMatch = url.pathname.match(/^\/api\/carts\/([^/]+)\/items$/);
  if (req.method === "POST" && itemMatch) {
    const payload = await readBody(req);
    const added = await proxyJson(`${cartUrl}/v1/carts/${itemMatch[1]}/items`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    sendJson(res, added.status, added.body);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/checkout") {
    const payload = await readBody(req);
    const placed = await proxyJson(`${checkoutUrl}/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    sendJson(res, placed.status, placed.body);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/scenarios") {
    const scenarios = await proxyJson(`${observability}/scenarios`);
    sendJson(res, scenarios.status, scenarios.body);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/tape") {
    const orderLogs = await proxyJson(`${observability}/logs?service=order-service&limit=12`);
    const payLogs = await proxyJson(`${observability}/logs?service=payments-gateway&limit=8`);
    const checkoutLogs = await proxyJson(`${observability}/logs?service=checkout&limit=8`);
    sendJson(res, 200, { orderLogs: orderLogs.body, payLogs: payLogs.body, checkoutLogs: checkoutLogs.body });
    return;
  }
  if (req.method === "GET" && serveStatic(url.pathname, res)) {
    return;
  }
  if (req.method === "GET" && !url.pathname.startsWith("/api/")) {
    sendText(res, 200, page, "text/html; charset=utf-8");
    return;
  }
  sendJson(res, 404, { error: "not found" });
});
