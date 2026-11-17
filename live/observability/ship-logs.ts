// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface ShipLog {
  timestamp: string;
  service: string;
  level: string;
  line: string;
  host?: string;
  traceId?: string;
  spanId?: string;
  orderId?: string;
  cartId?: string;
  tenantId?: string;
  routerId?: string;
  serviceVersion?: string;
  httpStatus?: number;
  scenario?: string;
}

export interface OpenSearchDoc {
  "@timestamp": string;
  service: string;
  level: string;
  message: string;
  trace_id?: string;
  span_id?: string;
  order_id?: string;
  cart_id?: string;
  tenant_id?: string;
  router_id?: string;
  service_version?: string;
  http_status?: number;
  scenario?: string;
}

export const INDEX_TEMPLATE = {
  index_patterns: ["orbit-logs-*"],
  template: {
    mappings: {
      properties: {
        "@timestamp": { type: "date" },
        service: { type: "keyword" },
        level: { type: "keyword" },
        message: { type: "text" },
        trace_id: { type: "keyword" },
        span_id: { type: "keyword" },
        order_id: { type: "keyword" },
        cart_id: { type: "keyword" },
        tenant_id: { type: "keyword" },
        router_id: { type: "keyword" },
        service_version: { type: "keyword" },
        http_status: { type: "integer" },
        scenario: { type: "keyword" },
      },
    },
  },
};

export function indexName(timestamp: string): string {
  const day = timestamp.slice(0, 10).replaceAll("-", ".");
  return `orbit-logs-${day}`;
}

export function toOpenSearchDoc(log: ShipLog): OpenSearchDoc {
  const doc: OpenSearchDoc = {
    "@timestamp": log.timestamp,
    service: log.service,
    level: log.level,
    message: log.line,
  };
  if (log.traceId) doc.trace_id = log.traceId;
  if (log.spanId) doc.span_id = log.spanId;
  if (log.orderId) doc.order_id = log.orderId;
  if (log.cartId) doc.cart_id = log.cartId;
  if (log.tenantId) doc.tenant_id = log.tenantId;
  if (log.routerId) doc.router_id = log.routerId;
  else if (log.host?.startsWith("or-router-")) doc.router_id = log.host;
  if (log.serviceVersion) doc.service_version = log.serviceVersion;
  if (typeof log.httpStatus === "number") doc.http_status = log.httpStatus;
  if (log.scenario) doc.scenario = log.scenario;
  return doc;
}

export function bulkBody(docs: OpenSearchDoc[]): string {
  return docs
    .flatMap((doc) => [JSON.stringify({ index: { _index: indexName(String(doc["@timestamp"])) } }), JSON.stringify(doc)])
    .join("\n")
    .concat("\n");
}

const queue: OpenSearchDoc[] = [];
let shipped = 0;
let dropped = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let templateReady = false;

export function shipStats(): { enabled: boolean; shipped: number; dropped: number } {
  return { enabled: Boolean(process.env.ORBIT_OPENSEARCH_URL), shipped, dropped };
}

function arm(): void {
  if (timer || !process.env.ORBIT_OPENSEARCH_URL) {
    return;
  }
  timer = setInterval(() => {
    void flushLogs();
  }, 500);
  timer.unref();
}

export async function ensureIndexTemplate(): Promise<void> {
  const base = process.env.ORBIT_OPENSEARCH_URL;
  if (!base || templateReady) {
    return;
  }
  const response = await fetch(`${base.replace(/\/$/, "")}/_index_template/orbit-logs`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(INDEX_TEMPLATE),
  });
  if (!response.ok) {
    throw new Error(`index template ${response.status}`);
  }
  templateReady = true;
}

export function enqueueLog(log: ShipLog): void {
  if (!process.env.ORBIT_OPENSEARCH_URL) {
    return;
  }
  queue.push(toOpenSearchDoc(log));
  arm();
  if (queue.length >= 50) {
    void flushLogs();
  }
}

export async function flushLogs(): Promise<void> {
  const base = process.env.ORBIT_OPENSEARCH_URL;
  if (!base || queue.length === 0) {
    return;
  }
  const batch = queue.splice(0, 100);
  try {
    if (!templateReady) {
      await ensureIndexTemplate();
    }
    const response = await fetch(`${base.replace(/\/$/, "")}/_bulk`, {
      method: "POST",
      headers: { "content-type": "application/x-ndjson" },
      body: bulkBody(batch),
    });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    shipped += batch.length;
  } catch {
    dropped += batch.length;
  }
}
