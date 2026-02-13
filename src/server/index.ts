// ─── Cortex Server ──────────────────────────────────────────────────────────
// Hono server for OpenClaw observability dashboard

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { api } from "./routes/api.js";
import { sse } from "./routes/sse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.join(__dirname, "../client");

const app = new Hono();

// Middleware
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

console.log(`Cortex v2 starting on http://localhost:${config.port}`);

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Cortex v2 ready at http://localhost:${info.port}`);
  },
);

export { app };
