-- Cortex v2 Initial Schema
-- SQLite with FTS5 for full-text search

CREATE TABLE log_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  level TEXT NOT NULL,        -- error, warn, info, debug
  source TEXT NOT NULL,       -- json-log, gateway-log, gateway-err
  message TEXT NOT NULL,
  raw TEXT,                   -- original line for debugging
  metadata TEXT,              -- JSON blob for extra fields
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_log_timestamp ON log_entries(timestamp);
CREATE INDEX idx_log_level ON log_entries(level);
CREATE INDEX idx_log_source ON log_entries(source);

-- Full-text search on message content
CREATE VIRTUAL TABLE log_entries_fts USING fts5(
  message,
  content='log_entries',
  content_rowid='id'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER log_entries_ai AFTER INSERT ON log_entries BEGIN
  INSERT INTO log_entries_fts(rowid, message) VALUES (new.id, new.message);
END;

CREATE TRIGGER log_entries_ad AFTER DELETE ON log_entries BEGIN
  INSERT INTO log_entries_fts(log_entries_fts, rowid, message) VALUES ('delete', old.id, old.message);
END;

CREATE TRIGGER log_entries_au AFTER UPDATE ON log_entries BEGIN
  INSERT INTO log_entries_fts(log_entries_fts, rowid, message) VALUES ('delete', old.id, old.message);
  INSERT INTO log_entries_fts(rowid, message) VALUES (new.id, new.message);
END;

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  agent TEXT,
  duration_ms INTEGER,
  success INTEGER,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_tool_timestamp ON tool_calls(timestamp);
CREATE INDEX idx_tool_name ON tool_calls(tool_name);

CREATE TABLE health_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  channels TEXT NOT NULL,     -- JSON: channel health data
  agents TEXT NOT NULL,       -- JSON: agent status
  sessions TEXT NOT NULL,     -- JSON: session summary
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_health_timestamp ON health_snapshots(timestamp);
