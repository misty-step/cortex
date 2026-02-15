import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SessionInfo } from "../../shared/types.js";

interface SessionData {
  [sessionKey: string]: Record<string, unknown>;
}

interface SessionSummary {
  mtime: number;
  count: number;
  latestTimestamp: number;
  currentModel: string | null;
}

interface CachedSessionData {
  mtime: number;
  data: SessionData;
}

// Cache for raw session data keyed by file path
const sessionDataCache = new Map<string, CachedSessionData>();
// Cache for aggregated summaries keyed by file path
const sessionSummaryCache = new Map<string, SessionSummary>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSessionData(value: unknown): value is SessionData {
  if (!isRecord(value)) return false;
  // All values in the record should also be records (session objects)
  for (const v of Object.values(value)) {
    if (!isRecord(v)) return false;
  }
  return true;
}

/** Clear all caches — exported for test isolation. */
export function clearSessionReaderCache(): void {
  sessionDataCache.clear();
  sessionSummaryCache.clear();
}

async function readSessionsFile(sessionsPath: string): Promise<SessionData> {
  const stat = await fs.stat(sessionsPath);
  const cached = sessionDataCache.get(sessionsPath);

  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.data;
  }

  const raw = await fs.readFile(sessionsPath, "utf-8");
  const data: unknown = JSON.parse(raw);

  if (!isSessionData(data)) {
    throw new Error(`Invalid sessions format in ${sessionsPath}`);
  }

  sessionDataCache.set(sessionsPath, { mtime: stat.mtimeMs, data });
  return data;
}

/**
 * Read sessions and return a summary (count, latest timestamp, current model).
 * Uses mtime-based caching to avoid re-reading unchanged files.
 */
export async function readSessionsSummary(sessionsPath: string): Promise<SessionSummary> {
  const stat = await fs.stat(sessionsPath);
  const cached = sessionSummaryCache.get(sessionsPath);

  if (cached && cached.mtime === stat.mtimeMs) {
    return cached;
  }

  const data = await readSessionsFile(sessionsPath);

  // Aggregate in a single pass
  let count = 0;
  let latestTimestamp = 0;
  let currentModel: string | null = null;

  for (const value of Object.values(data)) {
    count++;
    const ts = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    if (ts > latestTimestamp) {
      latestTimestamp = ts;
      currentModel = typeof value.model === "string" ? value.model : null;
    }
  }

  const summary: SessionSummary = { mtime: stat.mtimeMs, count, latestTimestamp, currentModel };
  sessionSummaryCache.set(sessionsPath, summary);
  return summary;
}

/**
 * Read sessions and return full SessionInfo array for all sessions.
 * Uses mtime-based caching internally.
 */
export async function readSessionsForAgent(
  sessionsPath: string,
  agentId: string,
): Promise<SessionInfo[]> {
  const data = await readSessionsFile(sessionsPath);
  const sessions: SessionInfo[] = [];

  for (const [sessionKey, session] of Object.entries(data)) {
    sessions.push({
      agent_id: agentId,
      session_key: sessionKey,
      status: session.systemSent ? "active" : "idle",
      start_time: session.createdAt ? new Date(session.createdAt as number).toISOString() : null,
      last_activity: session.updatedAt ? new Date(session.updatedAt as number).toISOString() : null,
      current_task: (session.task as string) || "—",
      model: session.model as string | undefined,
    });
  }

  return sessions;
}

/**
 * Check if a sessions file exists for an agent.
 */
export async function hasSessionsFile(agentDir: string): Promise<boolean> {
  const sessionsFile = path.join(agentDir, "sessions", "sessions.json");
  try {
    await fs.access(sessionsFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to an agent's sessions file.
 */
export function getSessionsPath(agentDir: string): string {
  return path.join(agentDir, "sessions", "sessions.json");
}
