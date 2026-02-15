import { Hono } from "hono";
import { collectHealth } from "../collectors/health.js";
import { collectSessions } from "../collectors/sessions.js";
import { collectCrons } from "../collectors/cron.js";
import { collectModels } from "../collectors/models.js";
import { collectAgents } from "../collectors/agents.js";
import { collectAgentDetail } from "../collectors/agent-detail.js";
import { collectSprites } from "../collectors/sprites.js";
import { config } from "../config.js";
import { queryLogs } from "../services/log-store.js";
import type { LogLevel, LogSource } from "../../shared/types.js";

/**
 * API router for Cortex monitoring and management endpoints.
 * All routes return JSON responses.
 */
const api = new Hono();

/**
 * GET /api/health
 * Health check endpoint that verifies gateway connectivity.
 *
 * @returns {HealthStatus} Gateway health status
 * @example
 * // Response
 * {
 *   "status": "ok",
 *   "gateway": "reachable",
 *   "timestamp": 1707830400000
 * }
 */
api.get("/health", async (c) => {
  const health = await collectHealth(config.gatewayPort);
  return c.json(health);
});

/**
 * GET /api/sessions
 * List all active sessions with optional filtering and pagination.
 *
 * @param {string} [limit=100] - Maximum items per page (1-10,000)
 * @param {string} [page=1] - Page number
 * @param {string} [q] - Search query (filters by agent_id, session_key, current_task)
 * @returns {PaginatedResponse<SessionInfo>} Paginated session list
 * @example
 * // Response
 * {
 *   "data": [{ "agent_id": "amos", "session_key": "...", "status": "active", ... }],
 *   "total": 42,
 *   "page": 1,
 *   "limit": 100,
 *   "hasMore": false
 * }
 */
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

  return c.json(paginateInMemory(filteredSessions, page, limit));
});

/**
 * Clamp an integer value within valid bounds.
 * @param raw - Raw string value from query param
 * @param fallback - Default value if parsing fails
 * @param max - Maximum allowed value
 * @returns Clamped integer
 */
function clampInt(raw: string | undefined, fallback: number, max: number): number {
  const parsed = parseInt(raw || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/**
 * Paginate an array in memory.
 * @param items - Array to paginate
 * @param page - Page number (1-indexed)
 * @param limit - Items per page
 * @returns Paginated response with metadata
 */
function paginateInMemory<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);
  const hasMore = offset + data.length < total;
  return { data, total, page, limit, hasMore };
}

/**
 * GET /api/logs
 * Query logs from SQLite with optional filtering.
 *
 * @param {string} [limit=100] - Maximum items per page (1-10,000)
 * @param {string} [page=1] - Page number
 * @param {string} [level] - Filter by log level (error, warn, info, debug)
 * @param {string} [q] - Search query for log message content
 * @returns {PaginatedResponse<LogEntry>} Paginated log entries
 * @example
 * // Response
 * {
 *   "data": [{ "id": 1, "timestamp": "...", "level": "info", "message": "..." }],
 *   "total": 150,
 *   "page": 1,
 *   "limit": 100,
 *   "hasMore": true
 * }
 */
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

/**
 * GET /api/crons
 * List all cron jobs with optional filtering and pagination.
 *
 * @param {string} [limit=100] - Maximum items per page (1-10,000)
 * @param {string} [page=1] - Page number
 * @param {string} [q] - Search query (filters by name, agent_id, schedule)
 * @returns {PaginatedResponse<CronJob>} Paginated cron job list
 * @example
 * // Response
 * {
 *   "data": [{ "id": "...", "name": "daily-backup", "schedule": "0 0 * * *", ... }],
 *   "total": 12,
 *   "page": 1,
 *   "limit": 100,
 *   "hasMore": false
 * }
 */
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

  return c.json(paginateInMemory(filteredCrons, page, limit));
});

/**
 * GET /api/models
 * List all available AI models and their status.
 *
 * @returns {ModelInfo[]} Array of model information
 * @example
 * // Response
 * [{ "id": "kimi-k2.5", "name": "Kimi K2.5", "provider": "moonshot", "status": "available" }]
 */
api.get("/models", async (c) => {
  const models = await collectModels();
  return c.json(models);
});

/**
 * GET /api/agents/:id
 * Get detailed information about a specific agent.
 *
 * @param {string} id - Agent ID (alphanumeric with hyphens/underscores)
 * @returns {AgentDetail} Detailed agent information
 * @returns {400} Invalid agent ID format
 * @returns {404} Agent not found
 * @example
 * // Response
 * {
 *   "id": "amos",
 *   "name": "Amos",
 *   "online": true,
 *   "sessionCount": 3,
 *   "workspace": "/home/user/.openclaw/workspace-amos",
 *   "model": { "primary": "kimi-k2.5", "fallbacks": ["gpt-4"] },
 *   ...
 * }
 */
api.get("/agents/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[\w-]+$/.test(id)) {
    return c.json({ error: "Invalid agent ID" }, 400);
  }
  const detail = await collectAgentDetail(config.openclawHome, id);
  if (!detail) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json(detail);
});

/**
 * GET /api/agents
 * List all agents with their status information.
 *
 * @returns {AgentStatus[]} Array of agent status summaries
 * @example
 * // Response
 * [{ "id": "amos", "name": "Amos", "online": true, "sessionCount": 3, ... }]
 */
api.get("/agents", async (c) => {
  const agents = await collectAgents(config.openclawHome);
  return c.json(agents);
});

/**
 * GET /api/errors
 * Query error-level logs from SQLite with optional filtering.
 *
 * @param {string} [limit=50] - Maximum items per page (1-10,000)
 * @param {string} [page=1] - Page number
 * @param {string} [q] - Search query for log message content
 * @param {string} [source] - Filter by source (json-log, gateway-log, gateway-err)
 * @returns {PaginatedResponse<LogEntry>} Paginated error log entries
 * @example
 * // Response
 * {
 *   "data": [{ "id": 1, "timestamp": "...", "level": "error", "message": "..." }],
 *   "total": 23,
 *   "page": 1,
 *   "limit": 50,
 *   "hasMore": false
 * }
 */
api.get("/errors", (c) => {
  const limit = clampInt(c.req.query("limit"), 50, 10_000);
  const page = clampInt(c.req.query("page"), 1, 100_000);
  const q = c.req.query("q");
  const VALID_SOURCES: Set<string> = new Set(["json-log", "gateway-log", "gateway-err"]);
  const rawSource = c.req.query("source");
  const source = rawSource && VALID_SOURCES.has(rawSource) ? (rawSource as LogSource) : undefined;
  const result = queryLogs({ level: "error", page, limit, q, source });
  return c.json(result);
});

/**
 * GET /api/sprites
 * List all sprites and their current status including task and runtime info.
 *
 * @returns {SpriteStatus[]} Array of sprite status information
 */
api.get("/sprites", async (c) => {
  try {
    const sprites = await collectSprites(config.openclawHome);
    return c.json(sprites);
  } catch (err) {
    console.error("[api/sprites] Failed to collect sprite status:", err);
    return c.json([]);
  }
});

export { api };
