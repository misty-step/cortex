import { describe, it, expect, afterEach } from "vitest";
import { sse } from "../../../src/server/routes/sse";

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
});
