import type { ParsedLogEntry } from "../types.js";

export function parseGatewayLogLine(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Format: "2026-02-08T14:29:47.758Z [subsystem] message"
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*\[([^\]]+)\]\s*(.+)$/);
  if (!match) return null;

  const [, time, subsystem, msg] = match;
  if (!time || !subsystem || !msg) return null;
  
  const message = msg.trim();
  
  // Infer level from message content
  const lowerMsg = message.toLowerCase();
  let level = "info";
  if (lowerMsg.includes("error") || lowerMsg.includes("fail")) level = "error";
  else if (lowerMsg.includes("warn")) level = "warn";

  return {
    time,
    level,
    subsystem: subsystem.trim(),
    message,
    ts: new Date(time).getTime(),
  };
}
