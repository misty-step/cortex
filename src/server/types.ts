// ─── Server-specific Types ──────────────────────────────────────────────────

export interface ParsedLogEntry {
  time: string;
  level: string;
  subsystem: string;
  message: string;
  ts: number;
}
