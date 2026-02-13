import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDb, closeDb, runMigrations } from "../../../src/server/db";
import { insertLogEntry } from "../../../src/server/services/log-store";
import * as path from "node:path";

// Mock collectors so routes don't need real filesystem/network
vi.mock("../../../src/server/collectors/health", () => ({
  collectHealth: vi.fn().mockResolvedValue({
    status: "ok",
    gateway: "reachable",
    timestamp: 1707000000000,
  }),
}));

vi.mock("../../../src/server/collectors/sessions", () => ({
  collectSessions: vi.fn().mockResolvedValue([
    {
      agent_id: "agent-1",
      session_key: "sess-1",
      status: "active",
      start_time: "2026-02-12T10:00:00.000Z",
      last_activity: "2026-02-12T11:00:00.000Z",
      current_task: "testing",
    },
  ]),
}));

vi.mock("../../../src/server/collectors/cron", () => ({
  collectCrons: vi.fn().mockResolvedValue([
    {
      id: "cron-1",
      name: "daily-check",
      agent_id: "agent-1",
      schedule: "0 0 * * *",
      last_run: null,
      next_run: null,
      status: "active",
      last_status: "ok",
    },
  ]),
}));

vi.mock("../../../src/server/collectors/models", () => ({
  collectModels: vi
    .fn()
    .mockReturnValue([
      { id: "test/model", name: "Test Model", provider: "test", status: "available" },
    ]),
}));

// Mock child_process for sprites route
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));
vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

// Import api statically — vi.mock is hoisted above imports
import { api } from "../../../src/server/routes/api";

describe("API routes", () => {
  beforeEach(() => {
    const db = initDb(":memory:");
    const migrationsDir = path.resolve(__dirname, "../../../migrations");
    runMigrations(db, migrationsDir);
  });

  afterEach(() => {
    closeDb();
  });

  // ── GET /health ───────────────────────────────────────────────────────

  it("should return health status from /health", async () => {
    const res = await api.request("/health");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      status: "ok",
      gateway: "reachable",
      timestamp: 1707000000000,
    });
  });

  // ── GET /sessions ─────────────────────────────────────────────────────

  it("should return paginated sessions from /sessions", async () => {
    const res = await api.request("/sessions");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(100);
    expect(body.data[0]!.agent_id).toBe("agent-1");
  });

  it("should respect limit and page on /sessions", async () => {
    const res = await api.request("/sessions?limit=1&page=1");
    const body = (await res.json()) as {
      data: unknown[];
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
  });

  it("should filter sessions by search query", async () => {
    const res = await api.request("/sessions?q=agent-1");
    const body = (await res.json()) as {
      data: Array<{ agent_id: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0]!.agent_id).toBe("agent-1");
  });

  // ── GET /models ───────────────────────────────────────────────────────

  it("should return models from /models", async () => {
    const res = await api.request("/models");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe("test/model");
  });

  // ── GET /crons ────────────────────────────────────────────────────────

  it("should return paginated crons from /crons", async () => {
    const res = await api.request("/crons");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Array<Record<string, unknown>>;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(100);
    expect(body.data[0]!.name).toBe("daily-check");
  });

  it("should respect limit and page on /crons", async () => {
    const res = await api.request("/crons?limit=1&page=1");
    const body = (await res.json()) as {
      data: unknown[];
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
  });

  it("should filter crons by search query", async () => {
    const res = await api.request("/crons?q=daily-check");
    const body = (await res.json()) as {
      data: Array<{ name: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0]!.name).toBe("daily-check");
  });

  // ── GET /logs ─────────────────────────────────────────────────────────

  it("should return paginated logs from /logs", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "test log",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/logs");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: unknown[];
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(100);
  });

  it("should filter logs by level", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "info entry",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "error entry",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/logs?level=error");
    const body = (await res.json()) as { data: Array<{ level: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]!.level).toBe("error");
  });

  it("should ignore invalid level values", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "test",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/logs?level=INVALID");
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(1);
  });

  it("should respect limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T10:0${i}:00.000Z`,
        level: "info",
        source: "json-log",
        message: `entry ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const res = await api.request("/logs?limit=2");
    const body = (await res.json()) as { data: unknown[]; hasMore: boolean };
    expect(body.data).toHaveLength(2);
    expect(body.hasMore).toBe(true);
  });

  it("should respect page parameter", async () => {
    for (let i = 0; i < 5; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T10:0${i}:00.000Z`,
        level: "info",
        source: "json-log",
        message: `entry ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const res = await api.request("/logs?limit=3&page=2");
    const body = (await res.json()) as { data: unknown[]; page: number };
    expect(body.data).toHaveLength(2);
    expect(body.page).toBe(2);
  });

  it("should support text search via q parameter", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "database connection established",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "request handled successfully",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/logs?q=database");
    const body = (await res.json()) as { data: Array<{ message: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]!.message).toContain("database");
  });

  it("should clamp limit to maximum 10000", async () => {
    const res = await api.request("/logs?limit=99999");
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBeLessThanOrEqual(10000);
  });

  it("should use default limit of 100 for invalid limit values", async () => {
    const res = await api.request("/logs?limit=abc");
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(100);
  });

  // ── GET /errors ───────────────────────────────────────────────────────

  it("should return only error-level logs from /errors", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "info",
      source: "gateway-log",
      message: "info entry",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "error entry",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/errors");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { data: Array<{ level: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]!.level).toBe("error");
  });

  it("should respect limit on /errors", async () => {
    for (let i = 0; i < 5; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T10:0${i}:00.000Z`,
        level: "error",
        source: "gateway-err",
        message: `error ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const res = await api.request("/errors?limit=2");
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(2);
  });

  it("should respect page parameter on /errors", async () => {
    // Clear existing entries and add fresh ones
    for (let i = 0; i < 5; i++) {
      insertLogEntry({
        timestamp: `2026-02-12T10:0${i}:00.000Z`,
        level: "error",
        source: "gateway-err",
        message: `error ${i}`,
        raw: null,
        metadata: null,
      });
    }

    const res = await api.request("/errors?limit=2&page=2");
    const body = (await res.json()) as { data: unknown[]; page: number };
    expect(body.page).toBe(2);
    expect(body.data).toHaveLength(2);
  });

  // ── GET /sprites ──────────────────────────────────────────────────────

  it("should return sprites with running status when processes found", async () => {
    mockExecFile.mockImplementation(
      (
        cmd: string,
        _args: string[],
        _opts: unknown,
        cb?: (err: Error | null, result: { stdout: string }) => void,
      ) => {
        if (cb) {
          if (cmd === "sprite") {
            cb(null, { stdout: "name   status\nbot1   active\nbot2   idle\n" });
          } else if (cmd === "pgrep") {
            cb(null, { stdout: "1234 node bot1 claude\n" });
          }
        }
        return { on: vi.fn() };
      },
    );

    const res = await api.request("/sprites");
    expect(res.status).toBe(200);

    const body = (await res.json()) as Array<{ name: string; status: string; agent_count: number }>;
    expect(body).toHaveLength(2);
    expect(body[0]!.name).toBe("bot1");
    expect(body[0]!.status).toBe("running");
    expect(body[0]!.agent_count).toBe(1);
    expect(body[1]!.name).toBe("bot2");
    expect(body[1]!.status).toBe("idle");
  });

  it("should return empty array when sprite command fails", async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null) => void) => {
        if (cb) {
          cb(new Error("sprite not found"));
        }
        return { on: vi.fn() };
      },
    );

    const res = await api.request("/sprites");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual([]);
  });
});
