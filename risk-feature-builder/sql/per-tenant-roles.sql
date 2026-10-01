-- Synthetic demo code for Nexus Intelligence. Not a real system.
-- Per-tenant warehouse roles. They can read the primary analytics schema only.
-- Replica schema analytics_r0 is not granted here.
GRANT USAGE ON SCHEMA analytics TO ROLE tenant_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO ROLE tenant_reader;
