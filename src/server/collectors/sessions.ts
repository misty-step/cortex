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

function toTimestampMs(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const asNum = Number(v);
    if (Number.isFinite(asNum)) return asNum;
  }
  return null;
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
        const sessionsData: unknown = JSON.parse(content);
        if (!sessionsData || typeof sessionsData !== "object") continue;

        // sessions.json contains multiple sessions keyed by session identifier
        for (const [sessionKey, session] of Object.entries(
          sessionsData as Record<string, unknown>,
        )) {
          const s =
            session && typeof session === "object" ? (session as Record<string, unknown>) : {};
          const createdAtMs = toTimestampMs(s["createdAt"]);
          const updatedAtMs = toTimestampMs(s["updatedAt"]);
          const task = typeof s["task"] === "string" ? s["task"] : null;
          const model = typeof s["model"] === "string" ? s["model"] : undefined;
          sessions.push({
            agent_id: agentId,
            session_key: sessionKey,
            status: s["systemSent"] ? "active" : "idle",
            start_time: createdAtMs ? new Date(createdAtMs).toISOString() : null,
            last_activity: updatedAtMs ? new Date(updatedAtMs).toISOString() : null,
            current_task: task || "—",
            model,
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
