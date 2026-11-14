// Synthetic demo code for Nexus Intelligence. Not a real system.

export interface LogEvent {
  timestamp: string;
  service: string;
  host?: string;
  level: string;
  line: string;
}

export interface MetricEvent {
  timestamp: string;
  service: string;
  ok: boolean;
  latencyMs: number;
  orderId?: string;
  submissions?: number;
}

export interface TraceSpan {
  name: string;
  service: string;
  durationMs: number;
  status: "OK" | "ERROR";
}

export interface TraceEvent {
  traceId: string;
  root: string;
  status: "OK" | "ERROR";
  durationMs: number;
  startedAt: string;
  spans: TraceSpan[];
}

const ingestUrl = () => process.env.OBSERVABILITY_INGEST_URL ?? "http://127.0.0.1:4490";

async function post(path: string, body: unknown): Promise<void> {
  try {
    await fetch(`${ingestUrl()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // The demo keeps serving if the tape is briefly down.
  }
}

export function emitLog(event: LogEvent): void {
  void post("/ingest/log", event);
}

export function emitMetric(event: MetricEvent): void {
  void post("/ingest/metric", event);
}

export function emitTrace(event: TraceEvent): void {
  void post("/ingest/trace", event);
}

export function emitDeploy(deploy: unknown): void {
  void post("/ingest/deploy", deploy);
}

export function emitBuildInfo(hosts: unknown): void {
  void post("/ingest/build-info", { hosts });
}
