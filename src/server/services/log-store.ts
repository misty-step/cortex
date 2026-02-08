// ─── Log Store ──────────────────────────────────────────────────────────────
// SQLite insert/query with FTS5 full-text search
// Implemented in PR 2

import type { LogEntry, LogQuery, PaginatedResponse } from "../../shared/types.js";

export function insertLogEntry(
  _entry: Omit<LogEntry, "id" | "createdAt">,
): void {
  // Implemented in PR 2
}

export function queryLogs(
  _query: LogQuery,
): PaginatedResponse<LogEntry> {
  // Implemented in PR 2
  return { data: [], total: 0, page: 1, limit: 100, hasMore: false };
}
