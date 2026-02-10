import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface SessionInfo {
  agent_id: string;
  session_key: string;
  status: string;
  start_time: string | null;
  last_activity: string | null;
  current_task: string | null;
  model?: string;
}

export async function collectSessions(openclawHome: string): Promise<SessionInfo[]> {
  const sessions: SessionInfo[] = [];
  const agentsDir = path.join(openclawHome, "agents");

  try {
    const dirents = await fs.readdir(agentsDir, { withFileTypes: true });
    const agentIds = dirents.filter((d) => d.isDirectory()).map((d) => d.name);

    for (const agentId of agentIds) {
      const sessionsFile = path.join(agentsDir, agentId, "sessions", "sessions.json");
      try {
        const content = await fs.readFile(sessionsFile, "utf-8");
        const sessionsData = JSON.parse(content);
        
        // sessions.json contains multiple sessions keyed by session identifier
        for (const [sessionKey, session] of Object.entries(sessionsData)) {
          const s = session as any;
          sessions.push({
            agent_id: agentId,
            session_key: sessionKey,
            status: s.systemSent ? "active" : "idle",
            start_time: s.createdAt ? new Date(s.createdAt).toISOString() : null,
            last_activity: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
            current_task: s.task || "—",
            model: s.model,
          });
        }
      } catch {
        // No sessions file for this agent
      }
    }
  } catch {
    // Agents dir doesn't exist
  }

  return sessions;
}
