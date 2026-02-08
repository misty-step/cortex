// ─── Gateway Error Log Parser ───────────────────────────────────────────────
// Parses ~/.openclaw/logs/gateway.err.log format
// Implemented in PR 2

import type { ParsedLogEntry } from "../types.js";

/**
 * Parse a line from gateway.err.log.
 * Format: "2026-02-08T14:29:47.758Z error message"
 * All entries are error-level.
 */
export function parseGatewayErrLine(_line: string): ParsedLogEntry | null {
  // Implemented in PR 2
  return null;
}
