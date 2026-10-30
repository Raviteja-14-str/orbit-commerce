// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface Column {
  name: string;
  type: string;
}

export interface SchemaView {
  database: string;
  columns: Column[];
}

/**
 * 1.9.2 reads system.columns for txn_features and does not filter by database.
 * system.columns lists every database the role can see. When the role can also
 * see the replica schema analytics_r0, the same table name is returned twice
 * (plus replica-only columns) and the feature file grows past the gateway's
 * preallocated limit of 200. The builder runs every 5 minutes on one warehouse
 * node (wh-1 .. wh-6), so the file flaps until every node has the grant.
 */
export function columnQuery(): string {
  return "SELECT name, type FROM system.columns WHERE table = 'txn_features' ORDER BY name";
}

export function collectColumns(visible: SchemaView[]): Column[] {
  const rows: Column[] = [];
  for (const schema of visible) {
    rows.push(...schema.columns);
  }
  return rows;
}

export function featureFileBytes(rows: Column[]): number {
  const body = rows.map((row) => `${row.name}\t${row.type}\n`).join("");
  return Buffer.byteLength(body, "utf8");
}

/** Log line written by the every-5-minute builder. Quotes inside SQL are doubled. */
export function formatBuilderLog(
  ts: string,
  gen: number,
  node: string,
  query: string,
  rows: number,
  fileBytes: number,
): string {
  const quoted = query.replaceAll("'", "''");
  const bytes = fileBytes.toLocaleString("en-US");
  return `${ts} gen=${gen} node=${node} query='${quoted}' rows=${rows} file_bytes=${bytes}`;
}
