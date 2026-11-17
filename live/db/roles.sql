-- Synthetic demo code for Nexus Intelligence. Not a real system.
-- Read-only investigator role. Password is the psql variable nexus_ro_password.
-- Apply with: psql -v nexus_ro_password=... -d orbit -f live/db/roles.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexus_ro') THEN
        CREATE ROLE nexus_ro LOGIN;
    END IF;
END
$$;

ALTER ROLE nexus_ro WITH LOGIN PASSWORD :'nexus_ro_password';
ALTER ROLE nexus_ro SET default_transaction_read_only = on;
ALTER ROLE nexus_ro SET statement_timeout = '5s';

GRANT CONNECT ON DATABASE orbit TO nexus_ro;
GRANT USAGE ON SCHEMA public TO nexus_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nexus_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO nexus_ro;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM nexus_ro;
