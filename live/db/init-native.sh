#!/usr/bin/env bash
# Synthetic demo code for Nexus Intelligence. Not a real system.
# Create the orbit database on a local Postgres (Homebrew postgresql@16 or apt postgresql-16).
# Superuser is the current OS user. Port defaults to 5432. Safe to run again.
set -euo pipefail

root="$(cd "$(dirname "$0")" && pwd)"
port="${PGPORT:-5432}"
passfile="${NEXUS_RO_PASSWORD_FILE:-$root/.nexus_ro_password}"

if [[ -n "${NEXUS_RO_PASSWORD:-}" ]]; then
  password="$NEXUS_RO_PASSWORD"
elif [[ -f "$passfile" ]]; then
  password="$(<"$passfile")"
else
  password="$(openssl rand -hex 18)"
fi

umask 077
printf '%s\n' "$password" >"$passfile"
chmod 600 "$passfile"
echo "nexus_ro password file: $passfile"

psql_cmd=(psql -v ON_ERROR_STOP=1 -p "$port")
if [[ -n "${PGHOST:-}" ]]; then
  psql_cmd+=(-h "$PGHOST")
fi

if ! "${psql_cmd[@]}" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'orbit'" | grep -q 1; then
  createdb -p "$port" ${PGHOST:+-h "$PGHOST"} orbit
fi

"${psql_cmd[@]}" -d orbit -f "$root/schema.sql"
"${psql_cmd[@]}" -d orbit -f "$root/seed.sql"
"${psql_cmd[@]}" -d orbit -v nexus_ro_password="$password" -f "$root/roles.sql"
echo "orbit database ready (schema, seed, role nexus_ro)"
