// ─── JSON Log Parser ────────────────────────────────────────────────────────
// Parses /tmp/openclaw/openclaw-YYYY-MM-DD.log format
// Implemented in PR 2

import type { ParsedLogEntry } from "../types.js";

/**
 * Parse a line from the JSON log file (/tmp/openclaw/openclaw-YYYY-MM-DD.log).
 *
 * Two formats:
 * 1. `openclaw logs --json` wrapper: { type: "log", time, level, subsystem, message }
 * 2. Raw numbered args: { "0": "...", "1": "...", _meta: { logLevelName, date, name } }
 */
export function parseJsonLogLine(_line: string): ParsedLogEntry | null {
  // Implemented in PR 2
  return null;
}
