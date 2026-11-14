<!-- Synthetic demo code for Nexus Intelligence. Not a real system. -->

# Orbit live observability API

Base URL: `http://127.0.0.1:4400`

This is the read contract for a Nexus connector. Responses are JSON. Unknown fields may be added later; clients should ignore fields they do not use. `generatedAt` and `time` are UTC ISO-8601. Log `line` values use the same text the incident evidence uses (time-of-day `Z` prefix, not a full date).

`errorRate` is a fraction from 0 to 1. `latencyMs.p50` and `latencyMs.p95` are milliseconds, or `null` when the window has no samples. `since` is an ISO-8601 instant. An invalid `since` returns HTTP 400 `{"error":"invalid since"}`.

CORS: `access-control-allow-origin: *` on this port.

## `GET /health`

```json
{
  "status": "ok",
  "service": "orbit-observability",
  "time": "2026-11-14T08:00:00.000Z"
}
```

## `GET /scenarios`

Faults are off after a fresh start and after `POST /control/heal`.

```json
{
  "generatedAt": "2026-11-14T08:00:00.000Z",
  "scenarios": [
    {
      "id": "NEX-32",
      "name": "B2B duplicate reprice",
      "summary": "or-router-07 stays on order-service 5.5.3. ENABLE_BULK_REPRICE runs BulkRepricer, which re-submits with a new idempotency key. Ansible recap is SUCCESS with unreachable=1.",
      "active": false
    },
    {
      "id": "NEX-28",
      "name": "Risk feature file over limit",
      "summary": "The feature builder's unscoped column query returns 412 features after analytics_r0 is visible. payments-gateway panics above the preallocated limit of 200. The file alternates on a 5 minute cycle (failing for the first 2.5 minutes).",
      "active": true,
      "phase": "failing",
      "features": 412,
      "limit": 200,
      "periodMs": 300000,
      "failMs": 150000,
      "activatedAt": "2026-11-14T08:00:00.000Z"
    },
    {
      "id": "NEX-30",
      "name": "inventory.svc DNS empty",
      "summary": "Checkout cannot resolve inventory.svc.orbit.internal and maps the DNS failure to OUT_OF_STOCK.",
      "active": false
    }
  ]
}
```

`phase` is only present on NEX-28. It is `failing` for the first `failMs` of every `periodMs` cycle measured from `activatedAt`, then `healthy`. With the defaults that is 2.5 minutes failing and 2.5 minutes healthy. While `active` is false, `phase` is `healthy` and `features` is 189.

## `GET /logs`

Query: `service` (optional), `host` (optional), `since` (optional ISO-8601), `limit` (optional, default 100, max 1000).

`timestamp` is the full instant for filtering. `line` is the evidence-shaped text.

```json
{
  "generatedAt": "2026-11-14T08:00:05.000Z",
  "logs": [
    {
      "timestamp": "2026-11-14T08:00:04.212Z",
      "service": "order-service",
      "host": "or-router-07",
      "level": "INFO",
      "line": "08:00:04.212Z INFO  BulkRepricer: ENABLE_BULK_REPRICE=true, starting legacy reprice loop"
    },
    {
      "timestamp": "2026-11-14T08:00:04.212Z",
      "service": "order-service",
      "host": "or-router-07",
      "level": "INFO",
      "line": "08:00:04.212Z INFO  BulkRepricer: re-submitting order ORD-55120 attempt=1 (fill status unknown)"
    },
    {
      "timestamp": "2026-11-14T08:00:04.118Z",
      "service": "order-service",
      "host": "or-router-01",
      "level": "INFO",
      "line": "08:00:04.118Z INFO  ContractPricing: applied contract price tenant=t_brightline order=ORD-55121"
    },
    {
      "timestamp": "2026-11-14T11:28:04.118Z",
      "service": "payments-gateway",
      "level": "ERROR",
      "line": "11:28:04.118Z ERROR risk-scoring thread=loader-2 PANIC: feature count 412 exceeds preallocated limit 200 (FeatureTable::load) - called unwrap() on Err(TooManyFeatures)"
    },
    {
      "timestamp": "2026-11-14T11:28:04.119Z",
      "service": "payments-gateway",
      "level": "ERROR",
      "line": "11:28:04.119Z ERROR http 500 POST /v1/authorizations trace_id=5a1f0c9e7b2d trace=risk.score -> panic"
    },
    {
      "timestamp": "2026-11-14T11:31:02.551Z",
      "service": "payments-gateway",
      "level": "INFO",
      "line": "11:31:02.551Z INFO  risk-scoring loaded feature file gen=7731 features=189 size=38.4KB"
    },
    {
      "timestamp": "2026-11-14T11:28:00.000Z",
      "service": "risk-feature-builder",
      "host": "wh-1",
      "level": "INFO",
      "line": "11:28:00Z gen=7730 node=wh-1 query='SELECT name, type FROM system.columns WHERE table = ''txn_features'' ORDER BY name' rows=412 file_bytes=79,312"
    },
    {
      "timestamp": "2026-11-14T03:20:41.009Z",
      "service": "checkout",
      "level": "ERROR",
      "line": "03:20:41.009Z ERROR reserve_stock failed: dial tcp: lookup inventory.svc.orbit.internal on 10.0.0.2:53: no such host -> mapped to OUT_OF_STOCK trace_id=c0ffee42aa71"
    }
  ]
}
```

Service names: `storefront-web`, `cart`, `pricing-service`, `checkout`, `payments-gateway`, `risk-feature-builder`, `order-service`.

## `GET /metrics`

Query: `service` (optional), `since` (optional ISO-8601).

When `service` is omitted, `services` lists the known services above. An unknown name returns a zero row rather than 404.

`requestRatePerSec` uses the window from `since` (or from the oldest sample) through now. `orders` is non-null only for `order-service`. `duplicateOrders` counts order ids whose submission count is greater than 1. `duplicateSubmissions` is the extra submissions beyond the first.

```json
{
  "generatedAt": "2026-11-14T08:05:00.000Z",
  "since": "2026-11-14T08:00:00.000Z",
  "services": [
    {
      "service": "order-service",
      "requests": 40,
      "errors": 0,
      "requestRatePerSec": 0.1333,
      "errorRate": 0,
      "latencyMs": { "p50": 18, "p95": 42 },
      "orders": { "placed": 40, "duplicateOrders": 5, "duplicateSubmissions": 15 }
    },
    {
      "service": "payments-gateway",
      "requests": 12,
      "errors": 12,
      "requestRatePerSec": 0.2,
      "errorRate": 1,
      "latencyMs": { "p50": 4, "p95": 9 },
      "orders": null
    }
  ]
}
```

## `GET /deploys`

`buildInfo` is the live per-host view. `deploys` is the history. A deploy id is replaced when the same id is reported again.

Healthy fleet: every host `build_info.version` is `5.6.0` and the recap is `PLAY RECAP ok=8 changed=8 unreachable=0 failed=0`.

NEX-32: deploy id `dpl-order-77310`, `or-router-07` is `5.5.3` and `reachable: false`, and the pipeline status stays `SUCCESS` because `failed` is 0.

```json
{
  "generatedAt": "2026-11-14T08:00:10.000Z",
  "buildInfo": [
    {
      "host": "or-router-01",
      "reachable": true,
      "build_info": { "service": "order-router", "version": "5.6.0" }
    },
    {
      "host": "or-router-07",
      "reachable": false,
      "build_info": { "service": "order-router", "version": "5.5.3" }
    }
  ],
  "deploys": [
    {
      "id": "dpl-order-77310",
      "service": "order-service",
      "status": "SUCCESS",
      "startedAt": "2026-11-14T08:00:04.000Z",
      "ansible": {
        "recap": "PLAY RECAP ok=7 changed=7 unreachable=1 failed=0",
        "ok": 7,
        "changed": 7,
        "unreachable": 1,
        "failed": 0,
        "status": "SUCCESS"
      },
      "hosts": [
        {
          "host": "or-router-07",
          "reachable": false,
          "build_info": { "service": "order-router", "version": "5.5.3" }
        }
      ]
    }
  ]
}
```

The live `buildInfo` array always contains all eight hosts `or-router-01` through `or-router-08`. The example above is shortened.

## `GET /traces`

Query: `limit` (optional, default 50, max 200). Newest traces are last.

```json
{
  "generatedAt": "2026-11-14T08:00:06.000Z",
  "traces": [
    {
      "traceId": "5a1f0c9e7b2d",
      "root": "checkout.place_order",
      "status": "ERROR",
      "durationMs": 37,
      "startedAt": "2026-11-14T08:00:06.000Z",
      "spans": [
        { "name": "checkout.place_order", "service": "checkout", "durationMs": 37, "status": "ERROR" },
        { "name": "cart.get_totals", "service": "cart", "durationMs": 1, "status": "OK" },
        { "name": "pricing.quote", "service": "pricing-service", "durationMs": 6, "status": "OK" },
        { "name": "payments.authorize", "service": "payments-gateway", "durationMs": 20, "status": "ERROR" },
        { "name": "risk.score", "service": "payments-gateway", "durationMs": 1, "status": "ERROR" },
        { "name": "order.created", "service": "order-service", "durationMs": 20, "status": "ERROR" }
      ]
    }
  ]
}
```

Span names used by checkout: `checkout.place_order`, `cart.get_totals`, `pricing.quote`, `payments.authorize`, `risk.score`, `order.created`.

## Control plane

These routes are on the same port. They are how `make break-nex32`, `make break-nex28`, `make break-nex30`, and `make heal` toggle faults. They are not required for a read-only connector.

`POST /control/faults`

```json
{ "id": "NEX-32", "active": true }
```

`id` is `NEX-32`, `NEX-28`, or `NEX-30`. The response is the same document as `GET /scenarios`. An unknown id is HTTP 400 `{"error":"unknown scenario"}`.

`POST /control/heal` with an empty body turns every fault off and returns `GET /scenarios`.

`GET /control/state` returns the raw fault slices (`active`, `activatedAt`, `periodMs`, `failMs`) for the services inside the compose network.

Ingest (`POST` on port 4490 inside the compose network) is not published to the host.
