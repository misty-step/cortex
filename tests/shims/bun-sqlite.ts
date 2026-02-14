// Shim: maps bun:sqlite → better-sqlite3 for Vitest (runs under Node, not Bun)
// Production uses bun:sqlite natively; this bridges the API gap in tests.
import Database from "better-sqlite3";
export { Database };
