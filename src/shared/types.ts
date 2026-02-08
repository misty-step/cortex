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

export interface HealthSnapshot {
  id: number;
  timestamp: string;
  channels: Record<string, unknown>;
  agents: Record<string, unknown>;
  sessions: Record<string, unknown>;
  createdAt: string;
}

export interface Session {
  key: string;
  agentId: string;
  model: string;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  updatedAt: number;
  ageMs: number;
}

export interface CronJob {
  name: string;
  agentId: string;
  enabled: boolean;
  schedule: {
    expr?: string;
    everyMs?: number;
  };
  state: {
    lastStatus?: string;
    lastRunAtMs?: number;
    lastDurationMs?: number;
    nextRunAtMs?: number;
    runningAtMs?: number;
  };
}

export interface GatewayHealth {
  ok: boolean;
  channels: Record<string, unknown>;
  agents: Array<{
    agentId: string;
    name: string;
    sessions: { count: number; recent: Array<{ updatedAt: number }> };
    heartbeat: { enabled: boolean };
  }>;
}

export interface ModelStatus {
  defaultModel: string;
  resolvedDefault: string;
  fallbacks: string[];
  allowed: string[];
  auth?: {
    providers: Array<{
      provider: string;
      profiles?: { count: number };
      env?: { value: unknown };
      effective?: { kind: string; detail: string };
    }>;
  };
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
