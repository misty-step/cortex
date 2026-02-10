import type { ParsedLogEntry } from "../types.js";

export function parseGatewayErrLine(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Format: "2026-02-08T14:29:47.758Z error message"
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*(.+)$/);
  if (!match) return null;

  const [, time, msg] = match;
  if (!time || !msg) return null;

  return {
    time,
    level: "error",
    subsystem: "gateway",
    message: msg.trim(),
    ts: new Date(time).getTime(),
  };
}
