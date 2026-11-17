-- Synthetic demo code for Nexus Intelligence. Not a real system.
-- A few days of historical contract orders. Live fault rows are written by the services, not here.
-- Idempotent: fixed ids, ON CONFLICT DO NOTHING.

INSERT INTO orders (order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version, created_at)
SELECT
    'ord-hist-' || g,
    (ARRAY['t_brightline', 't_kestrel', 't_halcyon', 't_northwind'])[1 + (g % 4)],
    'cart-hist-' || g,
    'idem-hist-' || g,
    'placed',
    (ARRAY[1899, 12900, 3499, 8900, 2199, 6900])[1 + (g % 6)],
    'USD',
    'or-router-0' || (1 + (g % 6)),
    '5.6.0',
    timestamptz '2026-11-16 18:00:00+00' - ((g * 3) || ' hours')::interval
FROM generate_series(1, 32) AS g
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO order_items (order_id, sku, qty, unit_price_cents)
SELECT
    'ord-hist-' || g,
    (ARRAY['SKU-HAMMER', 'SKU-DRILL', 'SKU-LAMP', 'SKU-FAUCET', 'SKU-KIT', 'SKU-LADDER'])[1 + (g % 6)],
    1 + (g % 3),
    (ARRAY[1899, 12900, 3499, 8900, 2199, 6900])[1 + (g % 6)]
FROM generate_series(1, 32) AS g
ON CONFLICT (order_id, sku) DO NOTHING;

INSERT INTO payments (payment_id, order_id, charge_id, amount_cents, status, provider, idempotency_key, created_at)
SELECT
    'pay-hist-' || g,
    'ord-hist-' || g,
    'ch-hist-' || g,
    (ARRAY[1899, 12900, 3499, 8900, 2199, 6900])[1 + (g % 6)],
    'captured',
    'card',
    'idem-hist-' || g,
    timestamptz '2026-11-16 18:00:02+00' - ((g * 3) || ' hours')::interval
FROM generate_series(1, 32) AS g
ON CONFLICT (payment_id) DO NOTHING;

INSERT INTO orders (order_id, tenant_id, cart_id, idempotency_key, status, total_cents, currency, router_id, service_version, created_at)
VALUES
    ('ord-hist-declined-1', 't_brightline', 'cart-hist-declined-1', 'idem-hist-declined-1', 'payment_failed', 12900, 'USD', 'or-router-02', '5.6.0', timestamptz '2026-11-14 11:12:00+00'),
    ('ord-hist-declined-2', 't_kestrel', 'cart-hist-declined-2', 'idem-hist-declined-2', 'payment_failed', 8900, 'USD', 'or-router-04', '5.6.0', timestamptz '2026-11-15 16:40:00+00')
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO order_items (order_id, sku, qty, unit_price_cents)
VALUES
    ('ord-hist-declined-1', 'SKU-DRILL', 1, 12900),
    ('ord-hist-declined-2', 'SKU-FAUCET', 1, 8900)
ON CONFLICT (order_id, sku) DO NOTHING;

INSERT INTO payments (payment_id, order_id, charge_id, amount_cents, status, provider, idempotency_key, created_at)
VALUES
    ('pay-hist-declined-1', 'ord-hist-declined-1', 'ch-hist-declined-1', 12900, 'declined', 'card', 'idem-hist-declined-1', timestamptz '2026-11-14 11:12:01+00'),
    ('pay-hist-declined-2', 'ord-hist-declined-2', 'ch-hist-declined-2', 8900, 'declined', 'card', 'idem-hist-declined-2', timestamptz '2026-11-15 16:40:01+00')
ON CONFLICT (payment_id) DO NOTHING;
