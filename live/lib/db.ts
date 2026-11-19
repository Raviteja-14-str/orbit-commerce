// Synthetic demo code for Nexus Intelligence. Not a real system.

import pg from "pg";

const pools = new Map<string, pg.Pool>();

function passwordFrom(url: string): string {
  const match = url.match(/^[a-z+]+:\/\/[^:/?#]*:([^@]*)@/i);
  if (!match) {
    return "";
  }
  return decodeURIComponent(match[1]);
}

/** Null when ORBIT_DATABASE_URL is unset. Callers keep the in-memory ledger. */
export function getPool(): pg.Pool | null {
  const url = process.env.ORBIT_DATABASE_URL;
  if (!url) {
    return null;
  }
  let pool = pools.get(url);
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, password: passwordFrom(url), max: 4 });
    pool.on("error", () => undefined);
    pools.set(url, pool);
  }
  return pool;
}

export async function closePools(): Promise<void> {
  await Promise.all([...pools.values()].map((pool) => pool.end()));
  pools.clear();
}
