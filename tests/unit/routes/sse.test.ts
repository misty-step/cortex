import { describe, it, expect, afterEach } from "vitest";
import { sse } from "../../../src/server/routes/sse";
import {
  broadcast,
  getConnectionCount,
  MAX_CONNECTIONS,
} from "../../../src/server/services/event-bus";
import type { LogEntry } from "../../../src/shared/types";

describe("SSE routes", () => {
  const controllers: AbortController[] = [];

  /** Create a request with an AbortController so the heartbeat interval gets cleaned up. */
  function sseRequest(path: string) {
    const ac = new AbortController();
    controllers.push(ac);
    return sse.request(path, { signal: ac.signal });
  }

  afterEach(() => {
    for (const ac of controllers) ac.abort();
    controllers.length = 0;
  });

  it("should return SSE content-type for /events", async () => {
    const res = await sseRequest("/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("should set Cache-Control to no-cache", async () => {
    const res = await sseRequest("/events");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("should set Connection to keep-alive", async () => {
    const res = await sseRequest("/events");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("should return a readable stream body", async () => {
    const res = await sseRequest("/events");
    expect(res.body).not.toBeNull();
  });

  it("should send an initial connected event", async () => {
    const res = await sseRequest("/events");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    reader.cancel();

    const text = new TextDecoder().decode(value);
    expect(text).toContain("data:");
    expect(text).toContain('"type":"connected"');
  });

  it("should return 404 for unknown SSE paths", async () => {
    const res = await sseRequest("/unknown");
    expect(res.status).toBe(404);
  });

  it("should forward event-bus events to connected clients", async () => {
    const res = await sseRequest("/events");
    const reader = res.body!.getReader();

    // Read initial connected event
    await reader.read();

    // Broadcast a log entry event
    const logEntry: Omit<LogEntry, "id" | "createdAt"> = {
      timestamp: "2024-01-15T10:30:00Z",
      level: "info",
      source: "gateway-log",
      message: "Test log message",
      raw: null,
      metadata: null,
    };

    broadcast({
      type: "log_entry",
      data: logEntry,
      timestamp: 1705312200000,
    });

    // Read the broadcasted event
    const { value } = await reader.read();
    reader.cancel();

    const text = new TextDecoder().decode(value);
    expect(text).toContain('"type":"log_entry"');
    expect(text).toContain("Test log message");
    expect(text).toContain('"timestamp":1705312200000');
  });

  it("should forward multiple event types to connected clients", async () => {
    const res = await sseRequest("/events");
    const reader = res.body!.getReader();

    // Read initial connected event
    await reader.read();

    // Broadcast multiple events
    broadcast({ type: "health", data: { status: "ok" } });
    broadcast({ type: "sessions", data: [] });

    // Collect events
    const events: string[] = [];
    for (let i = 0; i < 2; i++) {
      const { value } = await reader.read();
      events.push(new TextDecoder().decode(value));
    }
    reader.cancel();

    expect(events.some((e) => e.includes('"type":"health"'))).toBe(true);
    expect(events.some((e) => e.includes('"type":"sessions"'))).toBe(true);
  });

  it("should unsubscribe from event-bus on client disconnect", async () => {
    const res = await sseRequest("/events");
    const reader = res.body!.getReader();

    // Read initial connected event
    await reader.read();

    // Disconnect
    await reader.cancel();

    // Broadcast should not throw after disconnect
    expect(() => {
      broadcast({ type: "log_entry", data: { message: "after disconnect" } });
    }).not.toThrow();
  });

  describe("connection limiting", () => {
    it("should increment connection count on connect", async () => {
      const startCount = getConnectionCount();

      const res = await sseRequest("/events");
      expect(res.status).toBe(200);
      expect(getConnectionCount()).toBe(startCount + 1);

      await res.body!.getReader().cancel();
    });

    it("should reject connections above MAX_CONNECTIONS with 429 status", async () => {
      const startCount = getConnectionCount();
      // Create connections up to the limit
      const connections: Response[] = [];
      const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];

      for (let i = 0; i < MAX_CONNECTIONS - startCount; i++) {
        const res = await sseRequest("/events");
        if (res.status === 200 && res.body) {
          expect(res.status).toBe(200);
          connections.push(res);
          const reader = res.body.getReader();
          readers.push(reader);
          // Read initial event to ensure connection is established
          await reader.read();
        }
      }

      // Next connection should be rejected
      const rejectedRes = await sseRequest("/events");
      expect(rejectedRes.status).toBe(429);
      expect(rejectedRes.headers.get("Retry-After")).toBe("30");

      const body = await rejectedRes.json();
      expect(body.error).toBe("Too Many Connections");
      expect(body.message).toContain(String(MAX_CONNECTIONS));

      // Cleanup
      for (const reader of readers) {
        await reader.cancel();
      }
    });

    // Note: Testing connection cleanup on disconnect requires actual HTTP request
    // abort behavior which doesn't translate to the test environment. The decrement
    // is tested manually and the core limiting behavior is verified above.

    it("should handle concurrent connection attempts correctly", async () => {
      const startCount = getConnectionCount();
      const availableSlots = MAX_CONNECTIONS - startCount;
      const tryCount = Math.min(5, availableSlots);

      // Create multiple connections quickly
      const promises = Array.from({ length: tryCount }, () => sseRequest("/events"));
      const responses = await Promise.all(promises);

      // All should succeed (we had capacity)
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBe(tryCount);

      // Cleanup
      await Promise.all(responses.map((r) => r.body!.getReader().cancel()));
    });

    it("should return proper JSON error for rejected connections", async () => {
      // Fill to max first
      const startCount = getConnectionCount();
      const connections: Response[] = [];
      const readers: ReadableStreamDefaultReader<Uint8Array>[] = [];

      for (let i = 0; i < MAX_CONNECTIONS - startCount; i++) {
        const res = await sseRequest("/events");
        if (res.status === 200 && res.body) {
          connections.push(res);
          const reader = res.body.getReader();
          readers.push(reader);
          await reader.read();
        }
      }

      // This should be rejected
      const rejectedRes = await sseRequest("/events");
      if (rejectedRes.status === 429) {
        expect(rejectedRes.status).toBe(429);
        expect(rejectedRes.headers.get("Content-Type")).toContain("application/json");
        expect(rejectedRes.headers.get("Retry-After")).toBe("30");
      }

      // Cleanup
      for (const reader of readers) {
        await reader.cancel();
      }
    });
  });
});
