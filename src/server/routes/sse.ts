import { Hono } from "hono";

const sse = new Hono();

sse.get("/events", async (c) => {
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

      // Heartbeat every 30 seconds
      const interval = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 30000);

      // Cleanup on close
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(interval);
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
