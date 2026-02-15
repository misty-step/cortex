import type { LogEntry, LogQuery, PaginatedResponse } from "../../shared/types.js";
import { getDb } from "../db.js";
import { config } from "../config.js";

interface LogRow {
  id: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  raw: string | null;
  metadata: string | null;
  created_at: string;
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function rowToEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level as LogEntry["level"],
    source: row.source as LogEntry["source"],
    message: row.message,
    raw: row.raw,
    metadata: row.metadata ? safeParseJson(row.metadata) : null,
    createdAt: row.created_at,
  };
}

export function insertLogEntry(entry: Omit<LogEntry, "id" | "createdAt">): void {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO log_entries (timestamp, level, source, message, raw, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(
    entry.timestamp,
    entry.level,
    entry.source,
    entry.message,
    entry.raw || null,
    entry.metadata ? JSON.stringify(entry.metadata) : null,
  );
}

export function batchInsertLogEntries(entries: Omit<LogEntry, "id" | "createdAt">[]): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO log_entries (timestamp, level, source, message, raw, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const runBatch = db.transaction(() => {
    for (const entry of entries) {
      stmt.run(
        entry.timestamp,
        entry.level,
        entry.source,
        entry.message,
        entry.raw || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      );
    }
    pruneOldEntries(db);
  });
  runBatch();
}

/** Delete oldest entries beyond config.maxLogEntries. Accepts db to run within caller's transaction. */
function pruneOldEntries(db: ReturnType<typeof getDb>): void {
  db.prepare(
    `
    DELETE FROM log_entries WHERE id NOT IN (
      SELECT id FROM log_entries ORDER BY id DESC LIMIT ?
    )
  `,
  ).run(config.maxLogEntries);
}

export function queryLogs(query: LogQuery): PaginatedResponse<LogEntry> {
  const db = getDb();
  const { level, source, q, page = 1, limit = 100 } = query;

  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (level) {
    conditions.push("level = ?");
    params.push(level);
  }
  if (source) {
    conditions.push("source = ?");
    params.push(source);
  }
  if (q) {
    // Use FTS5 for full-text search — sanitize query to prevent operator injection
    // Allowlist: alphanumeric, whitespace, dots, underscores, forward slashes
    // This removes FTS5 operators: - (NOT), + (required), * (prefix), ^ (first token),
    // ~ (NEAR), ( ) (grouping), : (column filter), " (phrase), ' (phrase), {} (column names)
    const sanitized = q.replace(/[^a-zA-Z0-9\s._/]/g, "").trim();
    if (sanitized) {
      conditions.push("id IN (SELECT rowid FROM log_entries_fts WHERE log_entries_fts MATCH ?)");
      params.push(`"${sanitized}"*`);
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM log_entries ${whereClause}`);
  const { total } = countStmt.get(...params) as { total: number };

  const dataStmt = db.prepare(`
    SELECT * FROM log_entries ${whereClause}
    ORDER BY timestamp DESC, id DESC
    LIMIT ? OFFSET ?
  `);

  const rows = dataStmt.all(...params, limit, offset) as LogRow[];

  return {
    data: rows.map(rowToEntry),
    total,
    page,
    limit,
    hasMore: offset + rows.length < total,
  };
}
