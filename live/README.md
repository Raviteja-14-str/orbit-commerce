<!-- Synthetic demo code for Nexus Intelligence. Not a real system. -->

# Orbit Commerce live mode

A small running slice of the synthetic store, bound to `127.0.0.1` on ports 4400–4414 so it does not clash with Nexus on 4317/4318. Healthy at startup. Faults are off until you turn them on.

The payments path in this slice is a Node process that emits the same log lines as `payments-gateway` `FeatureTable::load` (limit 200, `TooManyFeatures`). The image does not compile Rust or C. Pricing is the Java `PriceEngine` from `pricing-service`.

## Prerequisites

- Docker Desktop 29 (or Docker Engine with Compose v2). Apple Silicon is fine: the Node and Temurin base images publish arm64 builds.
- About 1.5 GB of disk for the first image pull and about 1 GB of RAM while the stack is up.
- Eight containers: observability, pricing, cart, payments, orders, checkout, storefront, loadgen.
- The eight order routers (`or-router-01` … `or-router-08`) are workers inside the order-service container. `GET /deploys` still reports a per-host `build_info`.

Node and Java on the host are only needed for `make check`, not for `make live`.

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
