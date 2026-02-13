import type { LogEntry, LogQuery, PaginatedResponse } from "../../shared/types.js";
import { getDb } from "../db.js";

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

function rowToEntry(row: LogRow): LogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    level: row.level as LogEntry["level"],
    source: row.source as LogEntry["source"],
    message: row.message,
    raw: row.raw,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
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
    conditions.push("(message LIKE ? OR raw LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM log_entries ${whereClause}`);
  const { total } = countStmt.get(...params) as { total: number };

  const dataStmt = db.prepare(`
    SELECT * FROM log_entries ${whereClause}
    ORDER BY timestamp DESC
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
