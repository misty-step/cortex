import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentStatus } from "../../shared/types.js";

// 2 minutes — agents report heartbeat every ~60s, so 2x gives buffer for missed beats
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

interface SessionCache {
  mtime: number;
  sessions: Record<string, unknown>[];
  count: number;
}

const sessionCache = new Map<string, SessionCache>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSessionsCached(
  sessionsPath: string,
  agentId: string,
): Promise<{ sessions: Record<string, unknown>[]; count: number }> {
  const stat = await fs.stat(sessionsPath);
  const cached = sessionCache.get(agentId);
  if (cached && cached.mtime === stat.mtimeMs) {
    return { sessions: cached.sessions, count: cached.count };
  }

  const raw = await fs.readFile(sessionsPath, "utf-8");
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) throw new Error("invalid sessions format");

  const sessions: Record<string, unknown>[] = [];
  for (const value of Object.values(data)) {
    if (isRecord(value)) sessions.push(value);
  }

  const entry: SessionCache = { mtime: stat.mtimeMs, sessions, count: sessions.length };
  sessionCache.set(agentId, entry);
  return { sessions: entry.sessions, count: entry.count };
}

async function collectAgent(agentsDir: string, agentId: string): Promise<AgentStatus | null> {
  const agentDir = path.join(agentsDir, agentId);
  const configPath = path.join(agentDir, "config.json");

  try {
    const configRaw = await fs.readFile(configPath, "utf-8");
    const config: unknown = JSON.parse(configRaw);
    if (!isRecord(config)) return null;

    const sessionsFile = path.join(agentDir, "sessions", "sessions.json");
    let sessionCount = 0;
    let lastHeartbeat: string | null = null;
    let currentModel: string | null = null;
    let latestTimestamp = 0;

    try {
      const { sessions, count } = await readSessionsCached(sessionsFile, agentId);
      sessionCount = count;

      for (const session of sessions) {
        const ts = typeof session.updatedAt === "number" ? session.updatedAt : 0;
        if (ts > latestTimestamp) {
          latestTimestamp = ts;
          if (typeof session.model === "string") {
            currentModel = session.model;
          }
        }
      }

      lastHeartbeat = latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[collector/agents] Failed to read sessions for ${agentId}:`, err);
      }
    }

    const online = latestTimestamp > 0 && Date.now() - latestTimestamp < ONLINE_THRESHOLD_MS;

    return {
      id: agentId,
      name: (typeof config.name === "string" && config.name) || agentId,
      online,
      sessionCount,
      lastHeartbeat,
      currentModel,
      enabled: config.enabled !== false,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[collector/agents] Failed to read config for ${agentId}:`, err);
    }
    return null;
  }
}

export async function collectAgents(openclawHome: string): Promise<AgentStatus[]> {
  const agentsDir = path.join(openclawHome, "agents");

  try {
    const dirents = await fs.readdir(agentsDir, { withFileTypes: true });
    const agentIds = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

    // Process sequentially — only ~7 agents, avoids exhausting file descriptors
    const agents: AgentStatus[] = [];
    for (const id of agentIds) {
      const agent = await collectAgent(agentsDir, id);
      if (agent) agents.push(agent);
    }

    // Sort by online status (online first), then by name
    return agents.sort((a, b) => {
      if (a.online !== b.online) return b.online ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  } catch (err) {
    console.error("[collector/agents] Failed to read agents directory:", err);
    return [];
  }
}
