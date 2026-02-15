import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SessionInfo } from "../../shared/types.js";
import { readSessionsForAgent } from "../services/session-file-reader.js";

export async function collectSessions(openclawHome: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  const agentsDir = path.join(openclawHome, "agents");

  try {
    const dirents = await fs.readdir(agentsDir, { withFileTypes: true });
    const agentIds = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

    for (const agentId of agentIds) {
      const sessionsFile = path.join(agentsDir, agentId, "sessions", "sessions.json");
      try {
        const agentSessions = await readSessionsForAgent(sessionsFile, agentId);
        sessions.push(...agentSessions);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`[collector/sessions] Failed to read sessions for agent ${agentId}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[collector/sessions] Failed to read agents directory:", err);
  }

  return sessions;
}
