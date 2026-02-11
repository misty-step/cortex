import type { LogEntry, LogQuery, PaginatedResponse } from "../../shared/types.js";
import { getDb } from "../db.js";

export function insertLogEntry(entry: Omit<LogEntry, "id" | "createdAt">): void {
  const db = getDb();
  db.prepare(
    `
    INSERT INTO logs (timestamp, level, source, message, raw, metadata)
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
  const { level, source, q, page = 1, limit = 100 } = query;
  let db: ReturnType<typeof getDb>;

  try {
    db = getDb();
  } catch {
    return { data: [], total: 0, page, limit, hasMore: false };
  }

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

  try {
    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM logs ${whereClause}`);
    const { total } = countStmt.get(...params) as { total: number };

    const dataStmt = db.prepare(`
      SELECT * FROM logs ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = dataStmt.all(...params, limit, offset) as Array<Record<string, unknown>>;

    return {
      data: rows.map((r) => ({
        ...(r as unknown as LogEntry),
        metadata:
          typeof r["metadata"] === "string" && r["metadata"]
            ? (JSON.parse(r["metadata"]) as Record<string, unknown>)
            : null,
      })) as LogEntry[],
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  } catch {
    return { data: [], total: 0, page, limit, hasMore: false };
  }
}
