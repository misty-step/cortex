import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentStatus } from "../../shared/types.js";
import { readSessionsSummary, clearSessionReaderCache } from "../services/session-file-reader.js";

// Re-export clear function for test isolation
export { clearSessionReaderCache as clearSessionCache };

// 2 minutes — agents report heartbeat every ~60s, so 2x gives buffer for missed beats
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
