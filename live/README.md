<!-- Synthetic demo code for Nexus Intelligence. Not a real system. -->

# Orbit Commerce live mode

A small running slice of the synthetic store, bound to `127.0.0.1` on ports 4400–4414 so it does not clash with Nexus on 4317/4318. Healthy at startup. Faults are off until you turn them on.

The payments path in this slice is a Node process that emits the same log lines as `payments-gateway` `FeatureTable::load` (limit 200, `TooManyFeatures`). The image does not compile Rust or C. Pricing is the Java `PriceEngine` from `pricing-service`.

## Prerequisites

- Docker Desktop 29 (or Docker Engine with Compose v2). Apple Silicon is fine: the Node and Temurin base images publish arm64 builds.
- About 1.5 GB of disk for the first image pull and about 1 GB of RAM while the stack is up.
- Eight containers: observability, pricing, cart, payments, orders, checkout, storefront, loadgen.
- The eight order routers (`or-router-01` … `or-router-08`) are workers inside the order-service container. `GET /deploys` still reports a per-host `build_info`.

Node and Java on the host are only needed for `make check`, not for `make live`. Postgres and OpenSearch are optional. With `ORBIT_DATABASE_URL` and `ORBIT_OPENSEARCH_URL` unset, orders, payments, and logs stay in memory.

## Native Postgres and OpenSearch

On a Mac with Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
cd live && npm install
./db/init-native.sh
```

`init-native.sh` creates database `orbit`, applies `schema.sql`, loads `seed.sql`, and creates the read-only role `nexus_ro`. If `NEXUS_RO_PASSWORD` is set, that value is used. Otherwise the script generates a password and writes it to `live/db/.nexus_ro_password` (mode 600). It prints the file path, not the password. Running it again is safe.

From the repo root, with the live processes up:

```bash
export ORBIT_DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/orbit"
# If local TCP auth requires a password, put it in the URL:
# export ORBIT_DATABASE_URL="postgresql://$(whoami):PASSWORD@127.0.0.1:5432/orbit"
# Peer auth over the socket (typical Homebrew and apt installs):
# export ORBIT_DATABASE_URL="postgresql://$(whoami)@/orbit?host=/var/run/postgresql"
export ORBIT_OPENSEARCH_URL="http://127.0.0.1:59282"
export NEXUS_RO_PASSWORD="$(cat live/db/.nexus_ro_password)"
```

`ORBIT_DATABASE_URL` is read by order-service and payments-gateway. `ORBIT_OPENSEARCH_URL` is read by observability (no auth). `GET /logs` still reads the in-memory tape. The same lines are bulk-shipped to daily index `orbit-logs-YYYY.MM.DD`.

Checkout does not keep its own `ORD-55120` counter. It asks order-service for the next id (`POST /v1/order-ids`). On startup, order-service moves that counter to one past the highest `ORD-` number already in Postgres, including ids such as `ORD-66381-a2`. A restart then keeps inserting new orders. A payment is stored only when that order was created during the current order-service process. An insert that would overwrite an older order, or attach a payment to one, is written to the service log (`orbit ledger: ...`) and rejected. With `ORBIT_DATABASE_URL` unset, ids still start at `ORD-55120` in memory.

`make live` starts Postgres in Compose and sets `ORBIT_DATABASE_URL` for orders and payments. The Compose role password is the demo value `orbit-demo-ro`. OpenSearch is a Compose profile, published on `127.0.0.1:59282`:

```bash
docker compose -f live/docker-compose.yml --profile search up -d
```

Inside that network set `ORBIT_OPENSEARCH_URL=http://opensearch:9200`.

### Schema

- `orders` — one row per submission. `cart_id` ties a resubmit family together. `idempotency_key` is the key sent to payments. `router_id` and `service_version` record which order-router handled it.
- `order_items` — sku, qty, unit price. Primary key `(order_id, sku)`.
- `payments` — one row per authorization. `status` is `captured`, `failed`, or `declined`. `provider` is `card` or `risk-scoring`.

`nexus_ro` has `SELECT` only, `default_transaction_read_only=on`, and a 5 second `statement_timeout`.

### Investigator SQL

```bash
PGPASSWORD="$NEXUS_RO_PASSWORD" psql -h 127.0.0.1 -p 5432 -U nexus_ro -d orbit
```

NEX-32. Each BulkRepricer resubmit is its own order and its own charge. They share `cart_id`. The idempotency keys differ, which is why payments accepted them as new charges. The router is `or-router-07` on `5.5.3`:

```sql
SELECT cart_id,
       count(DISTINCT o.order_id) AS orders,
       count(p.payment_id) AS charges,
       count(DISTINCT p.idempotency_key) AS distinct_keys
FROM orders o
JOIN payments p ON p.order_id = o.order_id
WHERE o.router_id = 'or-router-07'
  AND o.service_version = '5.5.3'
GROUP BY cart_id
HAVING count(DISTINCT o.order_id) > 1;
```

NEX-28. Risk scoring rejected the authorization:

```sql
SELECT o.order_id, o.status, p.status AS payment_status, p.provider, p.amount_cents
FROM orders o
JOIN payments p ON p.order_id = o.order_id
WHERE p.provider = 'risk-scoring' OR o.status = 'payment_failed'
ORDER BY o.created_at DESC;
```

NEX-30. Checkout stored a reservation failure and did not take a payment:

```sql
SELECT o.order_id, o.cart_id, o.status, o.total_cents
FROM orders o
LEFT JOIN payments p ON p.order_id = o.order_id
WHERE o.status = 'out_of_stock' AND p.payment_id IS NULL;
```

OpenSearch uses the same scenario names. Saved searches are in `live/observability/saved-searches.json`.

```json
POST /orbit-logs-*/_search
{ "query": { "term": { "scenario": "NEX-32" } } }
```

Replace `NEX-32` with `NEX-28` or `NEX-30`. The `orbit-logs` index template maps `@timestamp`, `service`, `level`, `message`, `trace_id`, `span_id`, `order_id`, `cart_id`, `tenant_id`, `router_id`, `service_version`, `http_status`, and `scenario`.

## Start

From the repository root:

```bash
make live
```

That runs `docker compose -f live/docker-compose.yml up -d --build`.

- Storefront: http://127.0.0.1:4401 (Orbit Supply shop: departments, product pages, cart, stepped checkout, order history). It also runs with `node --experimental-strip-types live/storefront/server.ts` and no Docker.
- Observability API: http://127.0.0.1:4400 (see `live/API.md`)
- Checkout, cart, pricing, payments, and orders are also published on `127.0.0.1:4412`, `:4410`, `:4411`, `:4413`, and `:4414`.

Wait until `docker compose -f live/docker-compose.yml ps` shows the services healthy. The load generator then places a synthetic Brightline order about every 2 seconds.

## Break and heal

```bash
make break-nex32
make break-nex28
make break-nex30
make heal
```

| Target | Effect |
| --- | --- |
| `break-nex32` | `or-router-07` behaves as order-service 5.5.3 with `ENABLE_BULK_REPRICE=true` and re-submits the order (four charges, new idempotency key each time). The other seven routers stay on 5.6.0 and log `ContractPricing`. `GET /deploys` shows `dpl-order-77310` with `PLAY RECAP ok=7 changed=7 unreachable=1 failed=0` and status `SUCCESS`. About one order in eight is a duplicate. |
| `break-nex28` | The risk feature file goes to 412 columns, over the preallocated limit of 200. Authorizations return HTTP 500 and the panic / `trace=risk.score -> panic` lines. The failing phase lasts 2.5 minutes, then 2.5 minutes healthy, repeating. Turning the fault on starts in the failing phase immediately. |
| `break-nex30` | Checkout treats `inventory.svc.orbit.internal` as a DNS miss and returns Out of stock with the `no such host` log line. |
| `heal` | All three faults off. New checkouts are single submissions and payments succeed. Older log lines stay in the tape. `GET /metrics?since=<heal time>` is the clean window. |

The same toggles are `POST http://127.0.0.1:4400/control/faults` with `{"id":"NEX-32","active":true}` and `POST http://127.0.0.1:4400/control/heal`.

## Stop

```bash
make live-down
```

## What you should see on the storefront

Open http://127.0.0.1:4401, add a product, and check out.

- Healthy: one charge, router version `5.6.0`, a `ContractPricing` line.
- After `make break-nex32`, keep checking out (or watch the tape). A checkout that lands on `or-router-07` lists four charges and the BulkRepricer re-submit lines.
- After `make break-nex28`, checkout reports a payment failure.
- After `make break-nex30`, checkout reports Out of stock.
- `make heal` returns the next checkout to a single successful charge.

## Troubleshooting

- `curl: (7) Failed to connect` on port 4400: the stack is still starting, or Docker is not running. `docker compose -f live/docker-compose.yml ps` and `docker compose -f live/docker-compose.yml logs observability`.
- Port already in use: stop the other process on 4400–4414, then `make live` again.
- `permission denied` on the Docker socket: start Docker Desktop, or add your user to the `docker` group.
- Pricing stays unhealthy: `docker compose -f live/docker-compose.yml logs pricing`. The first Java compile is part of the image build.
- Containers are healthy but calls between them time out: the host firewall is dropping bridge traffic. Docker Desktop on a Mac does not do this. On a Linux host, `sysctl net.bridge.bridge-nf-call-iptables` should be 0, or the FORWARD chain must accept the compose bridge.
- Fault seems stuck: `curl -s http://127.0.0.1:4400/scenarios` then `make heal`.
- Duplicate orders do not appear in the first second after `break-nex32`: the workers poll fault state twice a second, and only `or-router-07` mis-prices. Give the load generator a few orders, or check out several times.
