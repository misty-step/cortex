import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  queryLogs,
  insertLogEntry,
  batchInsertLogEntries,
} from "../../../src/server/services/log-store";
import { initDb, closeDb, runMigrations } from "../../../src/server/db";
import * as path from "node:path";

describe("log-store", () => {
  beforeEach(() => {
    const db = initDb(":memory:");
    const migrationsDir = path.resolve(__dirname, "../../../migrations");
    runMigrations(db, migrationsDir);
  });

  afterEach(() => {
    closeDb();
  });

  // ── queryLogs ─────────────────────────────────────────────────────────

  it("should return empty results when no logs exist", () => {
    const result = queryLogs({});

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
    expect(result.hasMore).toBe(false);
  });

  it("should default page to 1 and limit to 100", () => {
    const result = queryLogs({});

    expect(result.page).toBe(1);
    expect(result.limit).toBe(100);
  });

  // ── insertLogEntry ────────────────────────────────────────────────────

  it("should insert and retrieve a log entry", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "Server started",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({});
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.message).toBe("Server started");
    expect(result.data[0]!.level).toBe("info");
    expect(result.data[0]!.source).toBe("gateway-log");
  });

  it("should assign auto-incrementing IDs", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "first",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "second",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({});
    expect(result.data[0]!.id).toBeGreaterThan(result.data[1]!.id);
  });

  it("should store and retrieve metadata as JSON", () => {
    insertLogEntry({
      timestamp: "2026-02-12T12:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "With metadata",
      raw: '{"original": true}',
      metadata: { tool: "test", duration: 42 },
    });

    const result = queryLogs({ q: "metadata" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.metadata).toEqual({ tool: "test", duration: 42 });
    expect(result.data[0]!.raw).toBe('{"original": true}');
  });

  it("should store null metadata and raw correctly", () => {
    insertLogEntry({
      timestamp: "2026-02-12T12:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "No extras",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({});
    expect(result.data[0]!.metadata).toBeNull();
    expect(result.data[0]!.raw).toBeNull();
  });

  it("should have a createdAt timestamp on inserted entries", () => {
    insertLogEntry({
      timestamp: "2026-02-12T12:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "check createdAt",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({});
    expect(result.data[0]!.createdAt).toBeTruthy();
  });

  // ── Filtering ─────────────────────────────────────────────────────────

  it("should filter by level", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "info msg",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "error msg",
      raw: null,
      metadata: null,
    });

    const errors = queryLogs({ level: "error" });
    expect(errors.total).toBe(1);
    expect(errors.data[0]!.level).toBe("error");

    const infos = queryLogs({ level: "info" });
    expect(infos.total).toBe(1);
    expect(infos.data[0]!.level).toBe("info");
  });

  it("should filter by source", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "from gateway",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "info",
      source: "json-log",
      message: "from json",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({ source: "json-log" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.source).toBe("json-log");
  });

  it("should filter by full-text search query", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "Server started on port 18789",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "Connection refused",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({ q: "started" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.message).toBe("Server started on port 18789");
  });

  it("should combine level and search query filters", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "Server started",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "Server crashed",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({ level: "error", q: "Server" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.message).toBe("Server crashed");
  });

  it("should handle FTS special characters in search query gracefully", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "test message",
      raw: null,
      metadata: null,
    });

    // Should not throw even with special chars
    const result = queryLogs({ q: 'test\'s "quoted" (parens) *star*' });
    expect(result).toBeDefined();
  });

  it("should sanitize FTS5 NOT operator (-)", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "error test message",
      raw: null,
      metadata: null,
    });

    // Query containing - should be sanitized to prevent FTS5 NOT syntax
    // "error-test" sanitized becomes "errortest" which won't match "error test"
    // But "error" alone will match - verifying no FTS5 syntax error occurs
    const result = queryLogs({ q: "error-test" });
    expect(result).toBeDefined();
    // Searching for just "error" should work
    const errorResult = queryLogs({ q: "error" });
    expect(errorResult.total).toBe(1);
  });

  it("should sanitize FTS5 required operator (+)", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "important info",
      raw: null,
      metadata: null,
    });

    // Query containing + should be sanitized
    const result = queryLogs({ q: "+important" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.message).toBe("important info");
  });

  it("should sanitize FTS5 column filter braces ({)", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "test message",
      raw: null,
      metadata: null,
    });

    // Query containing {col:term} syntax should be sanitized
    const result = queryLogs({ q: "{message:test}" });
    expect(result).toBeDefined();
    // Should still find the message despite braces being sanitized
    const searchResult = queryLogs({ q: "message" });
    expect(searchResult.total).toBe(1);
  });

  // ── Pagination ────────────────────────────────────────────────────────

  it("should paginate results correctly", () => {
    for (let i = 0; i < 7; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T10:0${i}:00.000Z`,
        level: "info",
        source: "json-log",
        message: `Entry ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const page1 = queryLogs({ limit: 3, page: 1 });
    expect(page1.data).toHaveLength(3);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(7);
    expect(page1.page).toBe(1);

    const page2 = queryLogs({ limit: 3, page: 2 });
    expect(page2.data).toHaveLength(3);
    expect(page2.hasMore).toBe(true);

    const page3 = queryLogs({ limit: 3, page: 3 });
    expect(page3.data).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });

  it("should return empty data for page beyond total", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "only one",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({ page: 5, limit: 10 });
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  // ── Ordering ──────────────────────────────────────────────────────────

  it("should order results by timestamp descending", () => {
    insertLogEntry({
      timestamp: "2026-02-12T08:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "earlier",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T12:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "later",
      raw: null,
      metadata: null,
    });

    const result = queryLogs({});
    expect(result.data[0]!.message).toBe("later");
    expect(result.data[1]!.message).toBe("earlier");
  });

  // ── batchInsertLogEntries ─────────────────────────────────────────────

  it("should insert multiple entries in a batch", () => {
    const entries = [
      {
        timestamp: "2026-02-12T10:00:00.000Z",
        level: "info" as const,
        source: "json-log" as const,
        message: "batch 1",
        raw: null,
        metadata: null,
      },
      {
        timestamp: "2026-02-12T10:01:00.000Z",
        level: "warn" as const,
        source: "gateway-log" as const,
        message: "batch 2",
        raw: null,
        metadata: null,
      },
      {
        timestamp: "2026-02-12T10:02:00.000Z",
        level: "error" as const,
        source: "gateway-err" as const,
        message: "batch 3",
        raw: null,
        metadata: null,
      },
    ];
    batchInsertLogEntries(entries);

    const result = queryLogs({});
    expect(result.total).toBe(3);
  });

  it("should insert empty batch without error", () => {
    batchInsertLogEntries([]);
    const result = queryLogs({});
    expect(result.total).toBe(0);
  });
});
