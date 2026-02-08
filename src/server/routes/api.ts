// ─── API Routes ─────────────────────────────────────────────────────────────
// REST endpoints for health, sessions, logs, crons, models, errors
// Implemented in PR 3

import { Hono } from "hono";

const api = new Hono();

// Placeholder — full implementation in PR 3
api.get("/health", (c) => c.json({ status: "not_implemented" }));
api.get("/sessions", (c) => c.json({ status: "not_implemented" }));
api.get("/logs", (c) => c.json({ status: "not_implemented" }));
api.get("/crons", (c) => c.json({ status: "not_implemented" }));
api.get("/models", (c) => c.json({ status: "not_implemented" }));
api.get("/errors", (c) => c.json({ status: "not_implemented" }));

export { api };
