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
  const sessions = await collectSessions(config.openclawHome);
  return c.json(sessions);
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
  const crons = await collectCrons(config.openclawHome);
  return c.json(crons);
});

// Models
api.get("/models", (c) => {
  const models = collectModels();
  return c.json(models);
});

// Errors (from SQLite, filtered to error level)
api.get("/errors", (c) => {
  const limit = clampInt(c.req.query("limit"), 50, 10_000);
  const result = queryLogs({ level: "error", limit });
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
