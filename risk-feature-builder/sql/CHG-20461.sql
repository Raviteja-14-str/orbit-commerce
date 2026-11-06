-- Synthetic demo code for Nexus Intelligence. Not a real system.
-- CHG-20461. Permissions only: grant the per-tenant reader role explicit
-- access to the replica schema analytics_r0. No schema or row change.
-- risk-feature-builder's system.columns query does not filter by database,
-- so columns from analytics_r0 are appended to the feature file on any
-- warehouse node (wh-1 .. wh-6) where this grant has been applied.
GRANT USAGE ON SCHEMA analytics_r0 TO ROLE tenant_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics_r0 TO ROLE tenant_reader;
