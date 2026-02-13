import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentStatus } from "../../shared/types.js";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export async function collectAgents(openclawHome: string): Promise<AgentStatus[]> {
  const agents: AgentStatus[] = [];
  const agentsDir = path.join(openclawHome, "agents");

  try {
    const dirents = await fs.readdir(agentsDir, { withFileTypes: true });
    const agentIds = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

    for (const agentId of agentIds) {
      const agentDir = path.join(agentsDir, agentId);
      const configPath = path.join(agentDir, "config.json");

      try {
        // Read agent config
        const configRaw = await fs.readFile(configPath, "utf-8");
        const config = JSON.parse(configRaw) as Record<string, unknown>;

        // Check for active sessions
        const sessionsFile = path.join(agentDir, "sessions", "sessions.json");
        let sessionCount = 0;
        let lastHeartbeat: string | null = null;
        let currentModel: string | null = null;

        try {
          const sessionsRaw = await fs.readFile(sessionsFile, "utf-8");
          const sessionsData = JSON.parse(sessionsRaw) as Record<string, Record<string, unknown>>;

          for (const [_sessionKey, session] of Object.entries(sessionsData)) {
            sessionCount++;
            const updatedAt = session.updatedAt as number | undefined;
            if (updatedAt) {
              const sessionTime = new Date(updatedAt).toISOString();
              if (!lastHeartbeat || sessionTime > lastHeartbeat) {
                lastHeartbeat = sessionTime;
              }
            }
            if (session.model && !currentModel) {
              currentModel = session.model as string;
            }
          }
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error(`[collector/agents] Failed to read sessions for ${agentId}:`, err);
          }
        }

        // Determine online status based on recent activity
        let online = false;
        if (lastHeartbeat) {
          const lastActivity = new Date(lastHeartbeat).getTime();
          online = Date.now() - lastActivity < ONLINE_THRESHOLD_MS;
        }

        agents.push({
          id: agentId,
          name: (config.name as string) || agentId,
          online,
          sessionCount,
          lastHeartbeat,
          currentModel,
          enabled: config.enabled !== false,
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`[collector/agents] Failed to read config for ${agentId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[collector/agents] Failed to read agents directory:", err);
  }

  // Sort by online status (online first), then by name
  return agents.sort((a, b) => {
    if (a.online !== b.online) return b.online ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
