import { Hono } from "hono";
import { collectHealth } from "../collectors/health.js";
import { collectSessions } from "../collectors/sessions.js";
import { collectCrons } from "../collectors/cron.js";
import { collectModels } from "../collectors/models.js";
import { config } from "../config.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { queryLogs } from "../services/log-store.js";
import type { LogLevel, SpriteStatus } from "../../shared/types.js";

const execFileAsync = promisify(execFile);

const api = new Hono();

// Health check
api.get("/health", async (c) => {
  const health = await collectHealth(config.gatewayPort);
  return c.json(health);
});

// Sessions
api.get("/sessions", async (c) => {
  const limit = clampInt(c.req.query("limit"), 100, 10_000);
  const page = clampInt(c.req.query("page"), 1, 100_000);
  const q = c.req.query("q");

  const allSessions = await collectSessions(config.openclawHome);

  // Filter by search query if provided
  let filteredSessions = allSessions;
  if (q) {
    const searchTerm = q.toLowerCase();
    filteredSessions = allSessions.filter(
      (s) =>
        s.agent_id.toLowerCase().includes(searchTerm) ||
        s.session_key.toLowerCase().includes(searchTerm) ||
        (s.current_task && s.current_task.toLowerCase().includes(searchTerm)),
    );
  }

  const total = filteredSessions.length;
  const offset = (page - 1) * limit;
  const data = filteredSessions.slice(offset, offset + limit);
  const hasMore = offset + data.length < total;

  return c.json({
    data,
    total,
    page,
    limit,
    hasMore,
  });
});

function clampInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = parseInt(raw || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

// Logs (from SQLite)
api.get("/logs", (c) => {
  const limit = clampInt(c.req.query("limit"), 100, 10_000);
  const VALID_LEVELS: Set<string> = new Set(["error", "warn", "info", "debug"]);
  const rawLevel = c.req.query("level");
  const level = rawLevel && VALID_LEVELS.has(rawLevel) ? (rawLevel as LogLevel) : undefined;
  const page = clampInt(c.req.query("page"), 1, 100_000);
  const q = c.req.query("q");

  const result = queryLogs({ level, page, limit, q });
  return c.json(result);
});

// Crons
api.get("/crons", async (c) => {
  const limit = clampInt(c.req.query("limit"), 100, 10_000);
  const page = clampInt(c.req.query("page"), 1, 100_000);
  const q = c.req.query("q");

  const allCrons = await collectCrons(config.openclawHome);

  // Filter by search query if provided
  let filteredCrons = allCrons;
  if (q) {
    const searchTerm = q.toLowerCase();
    filteredCrons = allCrons.filter(
      (cron) =>
        cron.name.toLowerCase().includes(searchTerm) ||
        cron.agent_id.toLowerCase().includes(searchTerm) ||
        cron.schedule.toLowerCase().includes(searchTerm),
    );
  }

  const total = filteredCrons.length;
  const offset = (page - 1) * limit;
  const data = filteredCrons.slice(offset, offset + limit);
  const hasMore = offset + data.length < total;

  return c.json({
    data,
    total,
    page,
    limit,
    hasMore,
  });
});

// Models
api.get("/models", (c) => {
  const models = collectModels();
  return c.json(models);
});

// Errors (from SQLite, filtered to error level)
api.get("/errors", (c) => {
  const limit = clampInt(c.req.query("limit"), 50, 10_000);
  const page = clampInt(c.req.query("page"), 1, 100_000);
  const result = queryLogs({ level: "error", limit, page });
  return c.json(result);
});

// Sprites (via CLI — uses execFile to prevent shell injection)
api.get("/sprites", async (c) => {
  try {
    const { stdout } = await execFileAsync("sprite", ["list"], { timeout: 15000 });
    const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("name"));

    const { stdout: psOut } = await execFileAsync("pgrep", ["-af", "claude|codex"], {
      timeout: 5000,
    }).catch(() => ({ stdout: "" }));
    const psLines = psOut.split("\n").filter((l) => l.trim());

    const sprites: SpriteStatus[] = lines.map((line) => {
      const name = line.split(/\s+/)[0] || "unknown";
      const agentCount = psLines.filter((p) => p.includes(name)).length;
      return {
        name,
        status: agentCount > 0 ? ("running" as const) : ("idle" as const),
        agent_count: agentCount,
        last_seen: agentCount > 0 ? new Date().toISOString() : null,
      };
    });

    return c.json(sprites);
  } catch (err) {
    console.error("[api/sprites] Failed to collect sprite status:", err);
    return c.json([]);
  }
});

export { api };
