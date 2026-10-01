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
 * 1.8.0 scopes system.columns to the current database.
 * Replica schemas the role cannot name are not part of the result.
 */
export function columnQuery(): string {
  return "SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = 'txn_features' ORDER BY name";
}

export function collectColumns(visible: SchemaView[], currentDatabase: string): Column[] {
  const rows: Column[] = [];
  for (const schema of visible) {
    if (schema.database !== currentDatabase) {
      continue;
    }
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
