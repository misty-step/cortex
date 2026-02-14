import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentStatus } from "../../shared/types.js";

// 2 minutes — agents report heartbeat every ~60s, so 2x gives buffer for missed beats
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

interface SessionSummary {
  mtime: number;
  count: number;
  latestTimestamp: number;
  currentModel: string | null;
}

const sessionCache = new Map<string, SessionSummary>();

/** Exported for test isolation — clears the module-level session cache. */
export function clearSessionCache(): void {
  sessionCache.clear();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readSessionsSummary(sessionsPath: string): Promise<SessionSummary> {
  const stat = await fs.stat(sessionsPath);
  const cached = sessionCache.get(sessionsPath);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached;
  }

  const raw = await fs.readFile(sessionsPath, "utf-8");
  const data: unknown = JSON.parse(raw);
  if (!isRecord(data)) throw new Error("invalid sessions format");

  // Aggregate in a single pass — don't store raw sessions
  let count = 0;
  let latestTimestamp = 0;
  let currentModel: string | null = null;
  for (const value of Object.values(data)) {
    if (!isRecord(value)) continue;
    count++;
    const ts = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    if (ts > latestTimestamp) {
      latestTimestamp = ts;
      // Reflect latest session's model (null if absent)
      currentModel = typeof value.model === "string" ? value.model : null;
    }
  }

  const summary: SessionSummary = { mtime: stat.mtimeMs, count, latestTimestamp, currentModel };
  sessionCache.set(sessionsPath, summary);
  return summary;
}

async function collectAgent(agentsDir: string, agentId: string): Promise<AgentStatus | null> {
  const agentDir = path.join(agentsDir, agentId);

  // config.json is optional — many agents only have sessions/ and agent/ dirs
  let configName: string | null = null;
  let configEnabled = true;
  try {
    const configRaw = await fs.readFile(path.join(agentDir, "config.json"), "utf-8");
    const config: unknown = JSON.parse(configRaw);
    if (isRecord(config)) {
      configName = typeof config.name === "string" ? config.name : null;
      configEnabled = config.enabled !== false;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[collector/agents] Failed to read config for ${agentId}:`, err);
    }
  }

  const sessionsFile = path.join(agentDir, "sessions", "sessions.json");
  let sessionCount = 0;
  let lastHeartbeat: string | null = null;
  let currentModel: string | null = null;
  let latestTimestamp = 0;

  try {
    const summary = await readSessionsSummary(sessionsFile);
    sessionCount = summary.count;
    latestTimestamp = summary.latestTimestamp;
    currentModel = summary.currentModel;
    lastHeartbeat = latestTimestamp ? new Date(latestTimestamp).toISOString() : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`[collector/agents] Failed to read sessions for ${agentId}:`, err);
    }
  }

  const online = latestTimestamp > 0 && Date.now() - latestTimestamp < ONLINE_THRESHOLD_MS;

  return {
    id: agentId,
    name: configName || agentId,
    online,
    sessionCount,
    lastHeartbeat,
    currentModel,
    enabled: configEnabled,
  };
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
