// Synthetic demo code for Nexus Intelligence. Not a real system.

import assert from "node:assert/strict";
import test from "node:test";
import { rules } from "../cdn-edge/src/bundle.ts";
import { handleProxyRequest } from "../cdn-edge/src/edge-proxy.ts";
import { WAF_EVAL_BUDGET_MS, formatWaf502, formatWafTimeout } from "../cdn-edge/src/waf.ts";
import { upstreamFor } from "../api-gateway/src/gateway.ts";
import { resolveStorefront, STORE_NOT_FOUND } from "../storefront-web/src/resolve-tenant.ts";
import { getTotals } from "../cart/src/cart.ts";
import { getProduct } from "../catalog/src/catalog.ts";
import { searchTitles } from "../search/src/search.ts";
import { placeOrder } from "../checkout/src/place-order.ts";
import { INVENTORY_HOST, reserveStock } from "../checkout/src/reserve-stock.ts";
import { collectColumns, columnQuery, formatBuilderLog } from "../risk-feature-builder/src/build-features.ts";
import { onHand, syncStock } from "../inventory/src/stock.ts";
import { DnsState, Worker } from "../dns-sync/src/worker.ts";
import { buildInfo } from "../order-service/src/build-info.ts";
import { handleOrder } from "../order-service/src/router.ts";
import { deliverWebhook } from "../notifications/src/deliver.ts";
import { TENANT_DOES_NOT_EXIST, login } from "../auth-sso/src/login.ts";
import { JOB_NAME, runMaintenance } from "../tenant-admin/src/maintenance.ts";
import { TenantRegistry, restoreEntity } from "../tenant-admin/src/registry.ts";
import { boot, heartbeat } from "../pos-kiosk/src/app.ts";
import { checkPodRoute } from "../platform-k8s/cilium/route-check.ts";
import { readFileSync } from "node:fs";

test("edge budget failure names the rule and stays on simulate semantics", () => {
  const ts = "14:42:13.402Z";
  const outcome = handleProxyRequest(
    [{ id: "ORB-WAF-1001", mode: "simulate", expression: "slow" }],
    { host: "shop.northwind.example", path: "/login", body: "", worker: 17 },
    {
      budgetMs: WAF_EVAL_BUDGET_MS,
      clock: (() => {
        let n = 0;
        return () => {
          n += WAF_EVAL_BUDGET_MS;
          return n;
        };
      })(),
      matcher: () => ({ code: -1, steps: 1_000_000 }),
    },
    ts,
  );
  assert.equal(outcome.status, 502);
  assert.equal(outcome.upstream, "none");
  assert.equal(outcome.logs[0], formatWafTimeout(ts, 17, WAF_EVAL_BUDGET_MS, "shop.northwind.example"));
  assert.equal(outcome.logs[1], formatWaf502("14:42:13.402Z", 17, "ORB-WAF-1001", "simulate"));
  assert.equal(outcome.version, "7.12.1");
  const credential = rules.find((rule) => rule.id === "ORB-WAF-1187");
  assert.equal(credential?.mode, "simulate");
  assert.equal(
    credential?.expression,
    "(?:(?:\\\"|'|\\]|\\}|\\\\|\\d|(?:nan|infinity|true|false|null))+[)]*;?((?:\\s|-|~|!|{}|\\|\\||\\+)*.*(?:.*=.*)))",
  );
  const simulated = handleProxyRequest(
    [credential!],
    { host: "shop.northwind.example", path: "/login", body: "null]null", worker: 17 },
    {
      budgetMs: WAF_EVAL_BUDGET_MS,
      clock: () => 0,
      matcher: () => ({ code: -1, steps: 9_000_000 }),
    },
    "14:42:13.406Z",
  );
  assert.equal(simulated.status, 502);
  assert.equal(simulated.upstream, "none");
  assert.equal(
    simulated.logs[1],
    "14:42:13.406Z ERROR worker=17 502 sent: waf evaluation exceeded budget rule_id=ORB-WAF-1187 mode=simulate",
  );
});

test("gateway routes login and checkout", () => {
  assert.equal(upstreamFor("/login"), "auth-sso");
  assert.equal(upstreamFor("/checkout/place"), "checkout");
});

test("storefront 404 and admin login share a missing tenant", () => {
  const response = resolveStorefront("shop.missing.example", () => null);
  assert.equal(response.status, 404);
  assert.equal(response.body, STORE_NOT_FOUND);
  assert.equal(login(false, true).error, TENANT_DOES_NOT_EXIST);
});

test("cart totals and checkout spans", () => {
  const totals = getTotals([{ sku: "SKU-1", qty: 2 }], () => 100);
  assert.equal(totals.totalMinor, 200);
  const placed = placeOrder(
    {
      cart: [{ sku: "SKU-1", qty: 1 }],
      onHand: 4,
      lookup: { ok: true },
      paymentApproved: true,
      ts: "03:20:41.009Z",
      traceId: "c0ffee42aa71",
    },
    () => 100,
  );
  assert.equal(placed.status, "placed");
  assert.ok(placed.spans.includes("pricing.quote"));
  assert.ok(placed.spans.includes("router.fanout"));
  assert.equal(deliverWebhook("ORD-1").span, "webhook.deliver");
});

test("dns failure is reported as OUT_OF_STOCK", () => {
  const result = reserveStock({ ok: false, reason: "no-such-host" }, 9, "03:20:41.009Z", "c0ffee42aa71");
  assert.equal(result.status, "OUT_OF_STOCK");
  assert.equal(
    result.log,
    "03:20:41.009Z ERROR reserve_stock failed: dial tcp: lookup inventory.svc.orbit.internal on 10.0.0.2:53: no such host -> mapped to OUT_OF_STOCK trace_id=c0ffee42aa71",
  );
  assert.equal(INVENTORY_HOST, "inventory.svc.orbit.internal");
});

test("dns-sync 2.3.0 can publish a stale plan and then empty inventory.svc", () => {
  const state = new DnsState();
  state.latestApplied = 18450;
  const slow = new Worker("az-b", state);
  const fast = new Worker("az-a", state);
  const repair = new Worker("az-c", state);
  assert.equal(slow.start({ gen: 18452, endpoints: { "inventory.svc": ["10.0.0.9"] } }, "02:53:14Z"), true);
  assert.match(state.logs[0], /worker=az-b plan=18452 freshness_check=ok \(latest_applied=18450\) starting/);
  slow.conflict("inventory.svc", 47, "02:58:40Z");
  for (let gen = 18440; gen <= 18458; gen += 1) {
    if (!state.plans.has(gen)) {
      state.plans.set(gen, { gen, endpoints: {} });
    }
  }
  fast.applyAll(
    { gen: 18467, endpoints: Object.fromEntries([["inventory.svc", ["10.1.0.1"]]]) },
    "03:11:58Z",
  );
  assert.ok(state.logs.some((line) => line.includes("worker=az-a plan=18467 applied endpoints=")));
  const wrote = slow.applyEndpoint(
    { gen: 18452, endpoints: { "inventory.svc": ["10.0.0.9"] } },
    "inventory.svc",
    "03:12:07Z",
  );
  assert.equal(wrote, true);
  assert.match(state.logs.at(-1) ?? "", /worker=az-b plan=18452 applied endpoint=inventory.svc/);
  fast.cleanup(18467, "03:12:08Z");
  assert.match(state.logs.at(-1) ?? "", /worker=az-a cleanup deleted_plans=\[18440\.\.18458\]/);
  assert.equal(state.endpoints.has("inventory.svc"), false);
  const repaired = repair.applyEndpoint(
    { gen: 18468, endpoints: { "inventory.svc": ["10.1.0.2"] } },
    "inventory.svc",
    "03:13:00Z",
  );
  assert.equal(repaired, false);
  assert.match(
    state.logs.at(-1) ?? "",
    /worker=az-c ERROR cannot apply plan 18468: active plan 18452 for inventory.svc not found; refusing \(state inconsistent\)/,
  );
});

test("feature builder query is not filtered by database", () => {
  const query = columnQuery();
  assert.equal(query, "SELECT name, type FROM system.columns WHERE table = 'txn_features' ORDER BY name");
  assert.doesNotMatch(query, /currentDatabase/);
  const primary = Array.from({ length: 189 }, (_, i) => ({ name: `f${i}`, type: "UInt64" }));
  const replica = Array.from({ length: 223 }, (_, i) => ({ name: `r${i}`, type: "UInt64" }));
  const onlyPrimary = collectColumns([{ database: "analytics", columns: primary }]);
  assert.equal(onlyPrimary.length, 189);
  const both = collectColumns([
    { database: "analytics", columns: primary },
    { database: "analytics_r0", columns: replica },
  ]);
  assert.equal(both.length, 412);
  const line = formatBuilderLog("11:28:00Z", 7730, "wh-1", query, both.length, 79312);
  assert.match(line, /query='SELECT name, type FROM system.columns WHERE table = ''txn_features'' ORDER BY name'/);
  assert.match(line, /rows=412/);
  assert.match(line, /file_bytes=79,312/);
});

test("stock sync keeps on-hand counts", () => {
  const totals = syncStock([
    { sku: "SKU-1", onHand: 5 },
    { sku: "SKU-1", onHand: 5 },
  ]);
  assert.equal(onHand(totals, "SKU-1"), 5);
});

test("5.5.3 flag off submits once; flag on resubmits with fresh keys", () => {
  assert.equal(buildInfo().version, "5.5.3");
  const once = handleOrder("5.5.3", false, { id: "ORD-1", tenant: "t_brightline", fillStatus: "unknown" }, "08:00:04.212Z", (n) => `k${n}`);
  assert.equal(once.path, "submit-once");
  assert.equal(once.submissions.length, 1);
  const loop = handleOrder("5.5.3", true, { id: "ORD-55120", tenant: "t_brightline", fillStatus: "unknown" }, "08:00:04.212Z", (n) => `k${n}`);
  assert.equal(loop.path, "bulk-repricer");
  assert.match(loop.logs[0], /ENABLE_BULK_REPRICE=true, starting legacy reprice loop/);
  assert.match(loop.logs[1], /re-submitting order ORD-55120 attempt=1 \(fill status unknown\)/);
  const keys = new Set(loop.submissions.map((s) => s.idempotencyKey));
  assert.equal(keys.size, loop.submissions.length);
});

test("catalog, search, tenant delete, pos boot, cilium route", () => {
  assert.equal(getProduct([{ sku: "SKU-1", title: "Hammer", merchant: "t_kestrel" }], "SKU-1")?.title, "Hammer");
  assert.deepEqual(searchTitles(["Red Hammer", "Nail"], "hammer"), ["Red Hammer"]);
  const registry = new TenantRegistry();
  registry.put({ id: "t_example", kind: "tenant" });
  const deleted = registry.deleteEntity("t_example", "svc-maint-batch", "01:12:03Z");
  assert.equal(deleted.status, 204);
  assert.equal(deleted.audit, "01:12:03Z actor=svc-maint-batch DELETE /v2/entities/t_example status=204");
  assert.equal(registry.get("t_example"), undefined);
  assert.throws(() => restoreEntity(registry, null), /restore point not available/);
  const registry2 = new TenantRegistry();
  registry2.put({ id: "addon_example", kind: "loyalty-addon" });
  const audits = runMaintenance(registry2, ["addon_example"], () => "01:12:03Z");
  assert.equal(JOB_NAME, "TEN-CLEAN-2026-11");
  assert.equal(audits[0], "01:12:03Z actor=svc-maint-batch DELETE /v2/entities/addon_example status=204");
  assert.equal(registry2.get("addon_example"), undefined);
  assert.equal(boot(false).event, "not_started");
  assert.equal(boot(true).event, "app_started");
  assert.match(heartbeat("2.13.0", 1), /app_started/);
  const missing = checkPodRoute("10.244.18.0/24", []);
  assert.equal(missing, 'level=error msg="route to 10.244.18.0/24 via cilium_host missing"');
  const limits = readFileSync("platform-k8s/orbit-node/limits.conf", "utf8");
  assert.match(limits, /nproc 32768/);
  const image = readFileSync("platform-k8s/orbit-node/Dockerfile", "utf8");
  assert.match(image, /2026\.10\.2/);
  const timer = readFileSync("platform-k8s/orbit-node/systemd/apt-daily-upgrade.timer.conf", "utf8");
  assert.match(timer, /OnCalendar=\*-\*-\* 06:00:00 UTC/);
  assert.match(timer, /RandomizedDelaySec=0/);
  const hook = readFileSync("platform-k8s/orbit-node/networkd/lxc-health-foreign-routes.sh", "utf8");
  assert.match(hook, /lxc_health: Lost carrier; removing foreign routes/);
});
