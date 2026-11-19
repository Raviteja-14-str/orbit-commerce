#!/bin/bash
# Synthetic demo code for Nexus Intelligence. Not a real system.
# Runs once on an empty Docker Postgres data directory. Does not print the role password.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /orbit-sql/schema.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /orbit-sql/seed.sql
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v nexus_ro_password="${NEXUS_RO_PASSWORD:?NEXUS_RO_PASSWORD is required}" \
  -f /orbit-sql/roles.sql
