import { Hono } from "hono";
import {
  subscribe,
  incrementConnection,
  decrementConnection,
  MAX_CONNECTIONS,
} from "../services/event-bus.js";
import type { SSEEvent } from "../../shared/types.js";

const sse = new Hono();

sse.get("/events", async (c) => {
  // Check connection limit before accepting
  if (!incrementConnection()) {
    return c.json(
      {
        error: "Too Many Connections",
        message: `Maximum concurrent SSE connections (${MAX_CONNECTIONS}) reached. Please retry later.`,
      },
      429,
      {
        "Retry-After": "30",
      },
    );
  }

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial connection event
      send({ type: "connected", timestamp: Date.now() });

      // Subscribe to event bus for real-time updates
      let isClosed = false;
      const unsubscribe = subscribe((event: SSEEvent) => {
        if (isClosed) return;
        try {
          send({
            type: event.type,
            data: event.data,
            timestamp: event.timestamp ?? Date.now(),
          });
        } catch {
          // Controller closed, ignore
          isClosed = true;
        }
      });

      // Heartbeat every 30 seconds
      const interval = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 30000);

      // Cleanup on close
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
        unsubscribe();
        isClosed = true;
        decrementConnection();
        try {
          controller.close();
        } catch {
          // Stream already closed — safe to ignore
        }
      });
    },
  });

  return c.body(stream);
});

export { sse };
