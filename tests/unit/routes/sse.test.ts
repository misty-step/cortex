import { describe, it, expect } from "vitest";
import { sse } from "../../../src/server/routes/sse";

describe("SSE routes", () => {
  it("should return SSE content-type for /events", async () => {
    const res = await sse.request("/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("should set Cache-Control to no-cache", async () => {
    const res = await sse.request("/events");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("should set Connection to keep-alive", async () => {
    const res = await sse.request("/events");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });

  it("should return a readable stream body", async () => {
    const res = await sse.request("/events");
    expect(res.body).not.toBeNull();
  });

  it("should send an initial connected event", async () => {
    const res = await sse.request("/events");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    reader.cancel();

    const text = new TextDecoder().decode(value);
    expect(text).toContain("data:");
    expect(text).toContain('"type":"connected"');
  });

  it("should return 404 for unknown SSE paths", async () => {
    const res = await sse.request("/unknown");
    expect(res.status).toBe(404);
  });
});
