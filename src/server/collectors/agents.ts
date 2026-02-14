import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentStatus } from "../../shared/types.js";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    let latestUpdatedAt = 0;

    try {
      const sessionsRaw = await fs.readFile(sessionsFile, "utf-8");
      const sessionsData: unknown = JSON.parse(sessionsRaw);
      if (!isRecord(sessionsData)) throw new Error("invalid sessions format");

      for (const session of Object.values(sessionsData)) {
        if (!isRecord(session)) continue;
        sessionCount++;
        const updatedAt = typeof session.updatedAt === "number" ? session.updatedAt : 0;
        if (updatedAt) {
          const sessionTime = new Date(updatedAt).toISOString();
          if (!lastHeartbeat || sessionTime > lastHeartbeat) {
            lastHeartbeat = sessionTime;
          }
        }
        if (typeof session.model === "string" && updatedAt > latestUpdatedAt) {
          latestUpdatedAt = updatedAt;
          currentModel = session.model;
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error(`[collector/agents] Failed to read sessions for ${agentId}:`, err);
      }
    }

    let online = false;
    if (lastHeartbeat) {
      const lastActivity = new Date(lastHeartbeat).getTime();
      online = Date.now() - lastActivity < ONLINE_THRESHOLD_MS;
    }

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

    const results = await Promise.all(agentIds.map((id) => collectAgent(agentsDir, id)));
    const agents = results.filter((a): a is AgentStatus => a !== null);

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
