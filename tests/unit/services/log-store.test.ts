import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initDb, closeDb } from "../../../src/server/db";
import { queryLogs } from "../../../src/server/services/log-store";

describe("log-store", () => {
  beforeAll(() => {
    const db = initDb(":memory:");
    db.exec(`
      CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        source TEXT NOT NULL DEFAULT 'unknown',
        message TEXT NOT NULL,
        raw TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
  });

  afterAll(() => {
    closeDb();
  });

  it("returns empty results when no logs exist", () => {
    const result = queryLogs({});
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
