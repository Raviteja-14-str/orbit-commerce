-- Synthetic demo code for Nexus Intelligence. Not a real system.
-- Orbit live ledger. Applied by live/db/init-native.sh and the Docker Postgres entrypoint.

CREATE TABLE IF NOT EXISTS orders (
    order_id text PRIMARY KEY,
    tenant_id text NOT NULL,
    cart_id text,
    idempotency_key text,
    status text NOT NULL,
    total_cents bigint NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    router_id text,
    service_version text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
    order_id text NOT NULL REFERENCES orders (order_id),
    sku text NOT NULL,
    qty integer NOT NULL,
    unit_price_cents bigint NOT NULL,
    PRIMARY KEY (order_id, sku)
);

CREATE TABLE IF NOT EXISTS payments (
    payment_id text PRIMARY KEY,
    order_id text NOT NULL REFERENCES orders (order_id),
    charge_id text NOT NULL,
    amount_cents bigint NOT NULL,
    status text NOT NULL,
    provider text NOT NULL,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_tenant_created_idx ON orders (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_cart_idx ON orders (cart_id);
CREATE INDEX IF NOT EXISTS orders_router_idx ON orders (router_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);
CREATE INDEX IF NOT EXISTS payments_idempotency_idx ON payments (idempotency_key);
CREATE INDEX IF NOT EXISTS payments_status_created_idx ON payments (status, created_at DESC);
