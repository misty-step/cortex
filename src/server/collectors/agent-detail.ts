import * as fs from "node:fs/promises";
import * as path from "node:path";
import { collectAgents } from "./agents.js";
import type {
  AgentDetail,
  AgentModelInfo,
  AgentAuthProfile,
  AgentSessionEntry,
} from "../../shared/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

interface MasterAgentEntry {
  workspace: string | null;
  model: { primary: string; fallbacks: string[] } | null;
  subagents: string[];
}

function parseMasterConfig(data: unknown, agentId: string): MasterAgentEntry | null {
  if (!isRecord(data)) return null;
  const agents = data.agents;
  if (!isRecord(agents)) return null;
  const list = agents.list;
  if (!Array.isArray(list)) return null;

  const entry = list.find((e: unknown) => isRecord(e) && e.id === agentId);
  if (!entry || !isRecord(entry)) return null;

  let model: MasterAgentEntry["model"] = null;
  if (isRecord(entry.model)) {
    const primary = typeof entry.model.primary === "string" ? entry.model.primary : "";
    const fallbacks = Array.isArray(entry.model.fallbacks)
      ? entry.model.fallbacks.filter((f): f is string => typeof f === "string")
      : [];
    model = { primary, fallbacks };
  }

  const subagents: string[] = [];
  if (isRecord(entry.subagents) && Array.isArray(entry.subagents.allowAgents)) {
    for (const a of entry.subagents.allowAgents) {
      if (typeof a === "string") subagents.push(a);
    }
  }

  return {
    workspace: typeof entry.workspace === "string" ? entry.workspace : null,
    model,
    subagents,
  };
}

function parseModels(data: unknown): AgentModelInfo[] {
  if (!isRecord(data) || !isRecord(data.providers)) return [];

  const models: AgentModelInfo[] = [];
  for (const [providerName, providerData] of Object.entries(data.providers)) {
    if (!isRecord(providerData) || !Array.isArray(providerData.models)) continue;
    for (const m of providerData.models) {
      if (!isRecord(m)) continue;
      models.push({
        id: typeof m.id === "string" ? m.id : "",
        name: typeof m.name === "string" ? m.name : "",
        provider: providerName,
        reasoning: m.reasoning === true,
        contextWindow: typeof m.contextWindow === "number" ? m.contextWindow : null,
        maxTokens: typeof m.maxTokens === "number" ? m.maxTokens : null,
      });
    }
  }
  return models;
}

function parseAuthProfiles(data: unknown): AgentAuthProfile[] {
  if (!isRecord(data) || !isRecord(data.profiles)) return [];

  const usageStats = isRecord(data.usageStats) ? data.usageStats : {};
  const profiles: AgentAuthProfile[] = [];

  for (const [profileId, profileData] of Object.entries(data.profiles)) {
    if (!isRecord(profileData)) continue;
    const stats = isRecord(usageStats[profileId]) ? usageStats[profileId] : {};
    profiles.push({
      provider: typeof profileData.provider === "string" ? profileData.provider : "",
      profileId,
      errorCount: typeof stats.errorCount === "number" ? stats.errorCount : 0,
      lastUsed: typeof stats.lastUsed === "number" ? stats.lastUsed : null,
      lastFailure: typeof stats.lastFailureAt === "number" ? stats.lastFailureAt : null,
    });
  }
  return profiles;
}

function parseSessions(data: unknown): { sessions: AgentSessionEntry[]; skills: string[] } {
  if (!isRecord(data)) return { sessions: [], skills: [] };

  const sessions: AgentSessionEntry[] = [];
  let latestTimestamp = 0;
  let latestSkills: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!isRecord(value)) continue;
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    sessions.push({
      key,
      updatedAt,
      model: typeof value.model === "string" ? value.model : null,
    });

    if (updatedAt > latestTimestamp && isRecord(value.skillsSnapshot)) {
      latestTimestamp = updatedAt;
      const resolved = value.skillsSnapshot.resolvedSkills;
      if (Array.isArray(resolved)) {
        latestSkills = resolved
          .filter((s): s is Record<string, unknown> => isRecord(s) && typeof s.name === "string")
          .map((s) => s.name as string);
      }
    }
  }

  // Sort sessions by updatedAt descending
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);

  return { sessions, skills: latestSkills };
}

export async function collectAgentDetail(
  openclawHome: string,
  agentId: string,
): Promise<AgentDetail | null> {
  // Get base AgentStatus
  const allAgents = await collectAgents(openclawHome);
  const base = allAgents.find((a) => a.id === agentId);
  if (!base) return null;

  const agentDir = path.join(openclawHome, "agents", agentId);

  // Read master config for agent-specific fields
  let masterEntry: MasterAgentEntry | null = null;
  try {
    const configData = await readJson(path.join(openclawHome, "openclaw.json"));
    masterEntry = parseMasterConfig(configData, agentId);
  } catch {
    // Missing or invalid master config — continue with defaults
  }

  // Read models.json
  let availableModels: AgentModelInfo[] = [];
  try {
    const modelsData = await readJson(path.join(agentDir, "agent", "models.json"));
    availableModels = parseModels(modelsData);
  } catch {
    // Missing models file
  }

  // Read auth-profiles.json
  let authProfiles: AgentAuthProfile[] = [];
  try {
    const authData = await readJson(path.join(agentDir, "agent", "auth-profiles.json"));
    authProfiles = parseAuthProfiles(authData);
  } catch {
    // Missing auth profiles file
  }

  // Read sessions.json
  let sessions: AgentSessionEntry[] = [];
  let skills: string[] = [];
  try {
    const sessionsData = await readJson(path.join(agentDir, "sessions", "sessions.json"));
    const parsed = parseSessions(sessionsData);
    sessions = parsed.sessions;
    skills = parsed.skills;
  } catch {
    // Missing sessions file
  }

  return {
    ...base,
    workspace: masterEntry?.workspace ?? null,
    model: masterEntry?.model ?? null,
    subagents: masterEntry?.subagents ?? [],
    availableModels,
    authProfiles,
    sessions,
    skills,
  };
}
