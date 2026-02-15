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

vi.mock("../../../src/server/collectors/agents", () => ({
  collectAgents: vi.fn().mockResolvedValue([
    {
      id: "main",
      name: "Kaylee",
      online: true,
      sessionCount: 3,
      lastHeartbeat: "2026-02-12T11:00:00.000Z",
      currentModel: "claude-opus-4-6",
      enabled: true,
    },
  ]),
}));

vi.mock("../../../src/server/collectors/agent-detail", () => ({
  collectAgentDetail: vi.fn().mockImplementation((_home: string, id: string) => {
    if (id === "main") {
      return Promise.resolve({
        id: "main",
        name: "Kaylee",
        online: true,
        sessionCount: 3,
        lastHeartbeat: "2026-02-12T11:00:00.000Z",
        currentModel: "claude-opus-4-6",
        enabled: true,
        workspace: "/home/user/workspace",
        model: { primary: "anthropic/claude-opus-4-6", fallbacks: [] },
        subagents: ["amos"],
        availableModels: [],
        authProfiles: [],
        sessions: [],
        skills: ["github"],
      });
    }
    return Promise.resolve(null);
  }),
}));

vi.mock("../../../src/server/collectors/sprites", () => ({
  collectSprites: vi.fn().mockResolvedValue([
    {
      name: "bot1",
      status: "running",
      agent_count: 1,
      last_seen: "2026-02-13T10:00:00.000Z",
      assigned_task: "testing",
      runtime_seconds: 300,
    },
    {
      name: "bot2",
      status: "idle",
      agent_count: 0,
      last_seen: null,
      assigned_task: null,
      runtime_seconds: null,
    },
  ]),
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

  it("should return paginated models from /models", async () => {
    const res = await api.request("/models");
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
    expect(body.data[0]!.id).toBe("test/model");
  });

  it("should respect limit and page on /models", async () => {
    const res = await api.request("/models?limit=1&page=1");
    const body = (await res.json()) as {
      data: unknown[];
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
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

  // ── GET /agents/:id ─────────────────────────────────────────────────

  it("should return agent detail for valid agent", async () => {
    const res = await api.request("/agents/main");
    expect(res.status).toBe(200);

    const body = (await res.json()) as { id: string; workspace: string; skills: string[] };
    expect(body.id).toBe("main");
    expect(body.workspace).toBe("/home/user/workspace");
    expect(body.skills).toEqual(["github"]);
  });

  it("should return 404 for nonexistent agent", async () => {
    const res = await api.request("/agents/nonexistent");
    expect(res.status).toBe(404);

    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Agent not found");
  });

  it("should return 400 for invalid agent ID", async () => {
    const res = await api.request("/agents/bad%20agent!");
    expect(res.status).toBe(400);
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

  it("should filter errors by source", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "gateway error",
      raw: null,
      metadata: null,
    });
    insertLogEntry({
      timestamp: "2026-02-12T10:01:00.000Z",
      level: "error",
      source: "json-log",
      message: "agent error",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/errors?source=gateway-err");
    const body = (await res.json()) as { data: Array<{ source: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]!.source).toBe("gateway-err");
  });

  it("should ignore invalid source values on /errors", async () => {
    insertLogEntry({
      timestamp: "2026-02-12T10:00:00.000Z",
      level: "error",
      source: "gateway-err",
      message: "gateway error",
      raw: null,
      metadata: null,
    });

    const res = await api.request("/errors?source=invalid-source");
    const body = (await res.json()) as { data: Array<{ source: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]!.source).toBe("gateway-err");
  });

  // ── GET /agents ───────────────────────────────────────────────────────

  it("should return paginated agents from /agents", async () => {
    const res = await api.request("/agents");
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
    expect(body.data[0]!.id).toBe("main");
  });

  it("should respect limit and page on /agents", async () => {
    const res = await api.request("/agents?limit=1&page=1");
    const body = (await res.json()) as {
      data: unknown[];
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(1);
  });

  it("should filter agents by search query", async () => {
    const res = await api.request("/agents?q=Kaylee");
    const body = (await res.json()) as {
      data: Array<{ name: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0]!.name).toBe("Kaylee");
  });

  // ── GET /sprites ──────────────────────────────────────────────────────

  it("should return paginated sprites from /sprites", async () => {
    const res = await api.request("/sprites");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      data: Array<{
        name: string;
        status: string;
        agent_count: number;
        assigned_task: string | null;
        runtime_seconds: number | null;
      }>;
      total: number;
      page: number;
      limit: number;
      hasMore: boolean;
    };
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(100);
    expect(body.data[0]!.name).toBe("bot1");
    expect(body.data[0]!.status).toBe("running");
    expect(body.data[0]!.agent_count).toBe(1);
    expect(body.data[0]!.assigned_task).toBe("testing");
    expect(body.data[0]!.runtime_seconds).toBe(300);
    expect(body.data[1]!.name).toBe("bot2");
    expect(body.data[1]!.status).toBe("idle");
    expect(body.data[1]!.assigned_task).toBeNull();
  });

  it("should filter sprites by search query", async () => {
    const res = await api.request("/sprites?q=bot1");
    const body = (await res.json()) as {
      data: Array<{ name: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0]!.name).toBe("bot1");
  });
});
