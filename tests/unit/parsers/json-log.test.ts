import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseJsonLogLine } from "../../../src/server/parsers/json-log";

describe("parseJsonLogLine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-12T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Format 1: { type: "log", ... } ──────────────────────────────────

  it("should parse a type=log entry with all fields", () => {
    const line = JSON.stringify({
      type: "log",
      time: "2026-02-08T14:29:47.758Z",
      level: "info",
      subsystem: "router",
      message: "Request handled",
    });

    const result = parseJsonLogLine(line);

    expect(result).toEqual({
      time: "2026-02-08T14:29:47.758Z",
      level: "info",
      subsystem: "router",
      message: "Request handled",
      ts: new Date("2026-02-08T14:29:47.758Z").getTime(),
    });
  });

  it("should default level to info when missing from type=log entry", () => {
    const line = JSON.stringify({
      type: "log",
      time: "2026-02-08T14:29:47.758Z",
      subsystem: "test",
      message: "no level",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("info");
  });

  it("should default subsystem to unknown when missing from type=log entry", () => {
    const line = JSON.stringify({
      type: "log",
      time: "2026-02-08T14:29:47.758Z",
      level: "info",
      message: "no subsystem",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.subsystem).toBe("unknown");
  });

  it("should default message to empty string when missing from type=log entry", () => {
    const line = JSON.stringify({
      type: "log",
      time: "2026-02-08T14:29:47.758Z",
      level: "error",
      subsystem: "test",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).toBe("");
  });

  it("should use current time when time is missing from type=log entry", () => {
    const line = JSON.stringify({
      type: "log",
      level: "info",
      subsystem: "test",
      message: "no time",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.time).toBe("2026-02-12T00:00:00.000Z");
  });

  // ── Format 2: _meta format ──────────────────────────────────────────

  it("should parse a _meta format entry", () => {
    const line = JSON.stringify({
      _meta: {
        date: "2026-02-08T14:29:47.758Z",
        logLevelName: "warn",
        name: "gateway",
      },
      0: "Connection timeout",
      1: "retrying in 5s",
    });

    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.time).toBe("2026-02-08T14:29:47.758Z");
    expect(result!.level).toBe("warn");
    expect(result!.subsystem).toBe("gateway");
    expect(result!.message).toBe("Connection timeout retrying in 5s");
  });

  it("should default logLevelName to info when missing from _meta", () => {
    const line = JSON.stringify({
      _meta: {
        date: "2026-02-08T14:29:47.758Z",
        name: "test",
      },
      0: "message",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.level).toBe("info");
  });

  it("should default name to unknown when missing from _meta", () => {
    const line = JSON.stringify({
      _meta: {
        date: "2026-02-08T14:29:47.758Z",
        logLevelName: "info",
      },
      0: "message",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.subsystem).toBe("unknown");
  });

  it("should use current time when date is missing from _meta", () => {
    const line = JSON.stringify({
      _meta: { logLevelName: "info", name: "test" },
      0: "no date",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.time).toBe("2026-02-12T00:00:00.000Z");
  });

  it("should exclude _meta key from message construction", () => {
    const line = JSON.stringify({
      _meta: { date: "2026-02-08T14:29:47.758Z", logLevelName: "info", name: "test" },
      0: "hello",
      1: "world",
    });
    const result = parseJsonLogLine(line);

    expect(result).not.toBeNull();
    expect(result!.message).not.toContain("_meta");
    expect(result!.message).toBe("hello world");
  });

  // ── Invalid input ───────────────────────────────────────────────────

  it("should return null for empty string", () => {
    expect(parseJsonLogLine("")).toBeNull();
  });

  it("should return null for whitespace-only string", () => {
    expect(parseJsonLogLine("   ")).toBeNull();
  });

  it("should return null for invalid JSON", () => {
    expect(parseJsonLogLine("{not valid json}")).toBeNull();
  });

  it("should return null for JSON without type=log or _meta", () => {
    const line = JSON.stringify({ foo: "bar", baz: 42 });
    expect(parseJsonLogLine(line)).toBeNull();
  });

  it("should return null for empty object", () => {
    expect(parseJsonLogLine("{}")).toBeNull();
  });

  it("should return null for JSON array", () => {
    expect(parseJsonLogLine("[1,2,3]")).toBeNull();
  });

  it("should return null for plain string JSON", () => {
    expect(parseJsonLogLine('"hello"')).toBeNull();
  });
});
