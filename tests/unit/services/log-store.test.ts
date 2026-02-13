import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { queryLogs, insertLogEntry } from "../../../src/server/services/log-store";
import { initDb, closeDb, runMigrations } from "../../../src/server/db";
import * as path from "node:path";

describe("log-store", () => {
  beforeAll(() => {
    const db = initDb(":memory:");
    const migrationsDir = path.resolve(__dirname, "../../../migrations");
    runMigrations(db, migrationsDir);
  });

  afterAll(() => {
    closeDb();
  });

  it("returns empty results when no logs exist", () => {
    const result = queryLogs({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it("inserts and retrieves a log entry", () => {
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

  it("filters by level", () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "Something failed",
      raw: null,
      metadata: null,
    });

    const errors = queryLogs({ level: "error" });
    expect(errors.total).toBe(1);
    expect(errors.data[0]!.level).toBe("error");

    const all = queryLogs({});
    expect(all.total).toBe(2);
  });

  it("filters by text search", () => {
    const result = queryLogs({ q: "started" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.message).toBe("Server started");
  });

  it("paginates results", () => {
    // Insert more entries
    for (let i = 0; i < 5; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T11:0${i}:00.000Z`,
        level: "info",
        source: "json-log",
        message: `Batch entry ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const page1 = queryLogs({ limit: 3, page: 1 });
    expect(page1.data).toHaveLength(3);
    expect(page1.hasMore).toBe(true);
    expect(page1.total).toBe(7); // 2 from earlier + 5 new

    const page2 = queryLogs({ limit: 3, page: 2 });
    expect(page2.data).toHaveLength(3);
    expect(page2.hasMore).toBe(true);

    const page3 = queryLogs({ limit: 3, page: 3 });
    expect(page3.data).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
  });

  it("stores and retrieves metadata as JSON", () => {
    insertLogEntry({
      timestamp: "2026-02-12T12:00:00.000Z",
      level: "info",
      source: "json-log",
      message: "With metadata",
      raw: '{"original": true}',
      metadata: { tool: "test", duration: 42 },
    });

    const result = queryLogs({ q: "With metadata" });
    expect(result.total).toBe(1);
    expect(result.data[0]!.metadata).toEqual({ tool: "test", duration: 42 });
    expect(result.data[0]!.raw).toBe('{"original": true}');
  });

  it("orders by timestamp descending", () => {
    const result = queryLogs({});
    const timestamps = result.data.map((e) => e.timestamp);
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });
});
