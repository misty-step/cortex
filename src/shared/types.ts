// ─── Shared Types ───────────────────────────────────────────────────────────
// Types shared between server and client

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
  raw: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type LogLevel = "error" | "warn" | "info" | "debug";
export type LogSource = "json-log" | "gateway-log" | "gateway-err";

export interface ToolCall {
  id: number;
  timestamp: string;
  toolName: string;
  agent: string | null;
  durationMs: number | null;
  success: boolean | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Collector / API Response Types ─────────────────────────────────────────
// These are the shapes returned by collectors and served via API routes.
// Client views consume these directly.

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  gateway: "reachable" | "unreachable";
  timestamp: number;
}

export interface SessionInfo {
  agent_id: string;
  session_key: string;
  status: string;
  start_time: string | null;
  last_activity: string | null;
  current_task: string | null;
  model?: string;
}

export interface CronJob {
  id: string;
  name: string;
  agent_id: string;
  schedule: string;
  last_run: string | null;
  next_run: string | null;
  status: string;
  last_status: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  status: string;
}

export interface SpriteStatus {
  name: string;
  status: "running" | "idle";
  agent_count: number;
  last_seen: string | null;
}

export interface AgentStatus {
  id: string;
  name: string;
  online: boolean;
  sessionCount: number;
  lastHeartbeat: string | null;
  currentModel: string | null;
  enabled: boolean;
}

// ─── Agent Detail Types ────────────────────────────────────────────────────

export interface AgentDetail extends AgentStatus {
  workspace: string | null;
  model: { primary: string; fallbacks: string[] } | null;
  subagents: string[];
  availableModels: AgentModelInfo[];
  authProfiles: AgentAuthProfile[];
  sessions: AgentSessionEntry[];
  skills: string[];
}

export interface AgentModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  contextWindow: number | null;
  maxTokens: number | null;
}

export interface AgentAuthProfile {
  provider: string;
  profileId: string;
  errorCount: number;
  lastUsed: number | null;
  lastFailure: number | null;
}

export interface AgentSessionEntry {
  key: string;
  updatedAt: number;
  model: string | null;
}

// ─── API Query Types ────────────────────────────────────────────────────────

export interface LogQuery {
  q?: string;
  level?: LogLevel;
  source?: LogSource;
  from?: string;
  to?: string;
  sort?: "timestamp" | "level";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ─── SSE Event Types ────────────────────────────────────────────────────────

export type SSEEventType =
  | "connected"
  | "health"
  | "sessions"
  | "error"
  | "tool_call"
  | "log_entry"
  | "crons"
  | "models";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp?: number;
}
