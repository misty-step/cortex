import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  SessionDetail,
  SessionMessage,
  MessageRole,
  MessageKind,
} from "../../shared/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const VALID_ROLES = new Set<MessageRole>(["user", "assistant", "tool", "system"]);
const VALID_KINDS = new Set<MessageKind>(["meta", "user", "assistant", "thinking", "tool"]);

function parseMessage(raw: unknown, agentId: string, sessionKey: string): SessionMessage | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === "string" ? raw.id : "";
  const rawRole = typeof raw.role === "string" ? raw.role : "user";
  const role: MessageRole = VALID_ROLES.has(rawRole as MessageRole)
    ? (rawRole as MessageRole)
    : "user";
  const rawKind = typeof raw.kind === "string" ? raw.kind : "user";
  const kind: MessageKind = VALID_KINDS.has(rawKind as MessageKind)
    ? (rawKind as MessageKind)
    : "user";
  const text = typeof raw.text === "string" ? raw.text : "";
  const timestampMs = typeof raw.timestampMs === "number" ? raw.timestampMs : 0;

  return { id, role, kind, text, sessionKey, agentId, timestampMs };
}

export async function collectSessionDetail(
  openclawHome: string,
  agentId: string,
  sessionKey: string,
): Promise<SessionDetail | null> {
  const agentsDir = path.join(openclawHome, "agents", agentId);
  const sessionsFile = path.join(agentsDir, "sessions", "sessions.json");

  // Read session metadata
  let status = "unknown";
  let startTime: string | null = null;
  let lastActivity: string | null = null;
  let currentTask: string | null = null;
  let model: string | null = null;

  try {
    const raw = await fs.readFile(sessionsFile, "utf-8");
    const sessionsData: unknown = JSON.parse(raw);
    if (isRecord(sessionsData)) {
      const session = sessionsData[sessionKey];
      if (isRecord(session)) {
        status = session.systemSent === true ? "active" : "idle";
        startTime =
          typeof session.createdAt === "number" && !isNaN(new Date(session.createdAt).getTime())
            ? new Date(session.createdAt).toISOString()
            : null;
        lastActivity =
          typeof session.updatedAt === "number" && !isNaN(new Date(session.updatedAt).getTime())
            ? new Date(session.updatedAt).toISOString()
            : null;
        currentTask = typeof session.task === "string" ? session.task : null;
        model = typeof session.model === "string" ? session.model : null;
      } else {
        // Session key not found in sessions.json
        return null;
      }
    }
  } catch {
    // sessions.json missing or unreadable — session doesn't exist
    return null;
  }

  // Read message history
  const messagesFile = path.join(agentsDir, "sessions", sessionKey, "messages.json");
  let messages: SessionMessage[] = [];

  try {
    const raw = await fs.readFile(messagesFile, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      messages = parsed
        .map((m) => parseMessage(m, agentId, sessionKey))
        .filter((m): m is SessionMessage => m !== null)
        .sort((a, b) => a.timestampMs - b.timestampMs);
    }
  } catch {
    // No messages file — return empty array
  }

  return {
    agentId,
    sessionKey,
    model,
    status,
    startTime,
    lastActivity,
    currentTask,
    messages,
  };
}
