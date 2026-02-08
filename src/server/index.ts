// ─── Cortex Server ──────────────────────────────────────────────────────────
// Hono server for OpenClaw observability dashboard

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { config } from "./config.js";

const app = new Hono();

// Middleware
app.use("*", cors());

// Health check
app.get("/api/ping", (c) => c.json({ ok: true, timestamp: Date.now() }));

// Placeholder routes — implemented in PR 2 & 3
app.get("/api/health", (c) => c.json({ status: "not_implemented" }));
app.get("/api/sessions", (c) => c.json({ status: "not_implemented" }));
app.get("/api/logs", (c) => c.json({ status: "not_implemented" }));
app.get("/api/crons", (c) => c.json({ status: "not_implemented" }));
app.get("/api/models", (c) => c.json({ status: "not_implemented" }));
app.get("/api/errors", (c) => c.json({ status: "not_implemented" }));
app.get("/api/events", (c) => c.json({ status: "not_implemented" }));

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
