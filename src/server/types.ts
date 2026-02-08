// ─── Server-specific Types ──────────────────────────────────────────────────

export interface ParsedLogEntry {
  time: string;
  level: string;
  subsystem: string;
  message: string;
  ts: number;
}

export interface CollectorState {
  health: unknown;
  status: unknown;
  sessions: unknown[];
  crons: unknown[];
  models: unknown;
  lastUpdated: Record<string, number>;
}

export interface LogTailerState {
  jsonLogSize: number;
  gwLogSize: number;
  gwErrLogSize: number;
}
