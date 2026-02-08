// ─── Gateway Log Parser ─────────────────────────────────────────────────────
// Parses ~/.openclaw/logs/gateway.log plain text format
// Implemented in PR 2

import type { ParsedLogEntry } from "../types.js";

/**
 * Parse a line from gateway.log.
 * Format: "2026-02-08T14:29:47.758Z [subsystem] message"
 * Level inferred from message content (error/warn keywords).
 */
export function parseGatewayLogLine(_line: string): ParsedLogEntry | null {
  // Implemented in PR 2
  return null;
}
