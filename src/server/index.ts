// ─── Cortex Server ──────────────────────────────────────────────────────────
// Hono server for OpenClaw observability dashboard

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import { config } from "./config.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as fs from "node:fs";
import { api } from "./routes/api.js";
import { sse } from "./routes/sse.js";
import { initDb, runMigrations, closeDb } from "./db.js";
import { startLogTailer, stopLogTailer } from "./services/log-tailer.js";
import { batchInsertLogEntries } from "./services/log-store.js";
import { broadcast } from "./services/event-bus.js";
import type { LogEntry } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, "../client");

// ─── Database ────────────────────────────────────────────────────────────────
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = initDb(config.dbPath);

const migrationsDir = path.resolve(__dirname, "../../migrations");
if (fs.existsSync(migrationsDir)) {
  runMigrations(db, migrationsDir);
}

// ─── Log Tailer ──────────────────────────────────────────────────────────────
const logDir = path.join(config.openclawHome, "logs");
startLogTailer(logDir, config.logDir, (entries) => {
  const logEntries: Omit<LogEntry, "id" | "createdAt">[] = entries.map(({ entry, source }) => ({
    timestamp: entry.time,
    level: entry.level as "error" | "warn" | "info" | "debug",
    source,
    message: entry.message,
    raw: null,
    metadata: null,
  }));

  // Persist to database
  batchInsertLogEntries(logEntries);

  // Broadcast to connected SSE clients
  for (const entry of logEntries) {
    broadcast({
      type: "log_entry",
      data: entry,
      timestamp: Date.now(),
    });
  }
}).catch((err) => {
  console.error("[cortex] Log tailer failed to start:", err);
});

// ─── App ─────────────────────────────────────────────────────────────────────
const app = new Hono();

// Middleware - set security headers individually to avoid default CSP
// The default CSP includes upgrade-insecure-requests which breaks local HTTP
app.use(
  "*",
  secureHeaders({
    strictTransportSecurity: true,
    xContentTypeOptions: true,
    xDnsPrefetchControl: true,
    xFrameOptions: true,
    xDownloadOptions: true,
    xPermittedCrossDomainPolicies: true,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: true,
    crossOriginOpenerPolicy: true,
    originAgentCluster: true,
    referrerPolicy: true,
    removePoweredBy: true,
  }),
);
app.use(
  "*",
  cors({
    origin: [`http://localhost:${config.port}`, "http://localhost:5173"],
  }),
);

// Static files (frontend)
app.use("/*", serveStatic({ root: CLIENT_ROOT }));

// API routes
app.route("/api", api);

// SSE events
app.route("/api", sse);

// Ping endpoint
app.get("/api/ping", (c) => c.json({ ok: true, timestamp: Date.now() }));

// Global error handler
app.onError((err, c) => {
  // Pass through Hono's HTTPException to preserve status codes (e.g., 400, 401, 404)
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(`[cortex] Unhandled error: ${c.req.method} ${c.req.url}`, err);
  return c.json({ error: "Internal server error" }, 500);
});

Bun.serve({
  fetch: app.fetch,
  port: config.port,
});
console.log(`Cortex v2 ready at http://localhost:${config.port}`);

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
function shutdown() {
  console.log("[cortex] Shutting down...");
  stopLogTailer();
  closeDb();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { app };
