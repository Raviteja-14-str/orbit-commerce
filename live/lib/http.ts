// Synthetic demo code for Nexus Intelligence. Not a real system.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "content-length": Buffer.byteLength(raw),
  });
  res.end(raw);
}

export function sendText(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

export function listen(port: number, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void): void {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "error";
      if (!res.headersSent) {
        sendJson(res, 500, { error: message });
      } else {
        res.end();
      }
    });
  });
  server.listen(port, "0.0.0.0");
}
