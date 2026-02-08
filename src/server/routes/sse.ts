// ─── SSE Route ──────────────────────────────────────────────────────────────
// Server-Sent Events endpoint for real-time dashboard updates
// Implemented in PR 3

import { Hono } from "hono";

const sse = new Hono();

// Placeholder — full implementation in PR 3
sse.get("/events", (c) => c.json({ status: "not_implemented" }));

export { sse };
