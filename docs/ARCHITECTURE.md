# Cortex Architecture

> Real-time observability dashboard for OpenClaw gateway.

## Overview

Cortex v2 is a Hono + React application that collects, persists, and visualizes operational data from the OpenClaw gateway. It replaces the ad-hoc shell scripts of cortex.js with a structured SQLite-backed system featuring full-text search, real-time updates, and a modern React frontend.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ OpenClaw CLI │  │ gateway.log  │  │gateway.err.  │  │ JSON log files │  │
│  │  (health,    │  │  (plain text │  │   log        │  │ (/tmp/openclaw/│  │
│  │  sessions)   │  │   events)    │  │  (errors)    │  │  YYYY-MM-DD)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼───────────────────┼──────────┘
          │                 │                 │                   │
          ▼                 ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARSERS (src/server/parsers/)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │gateway-log.ts│  │gateway-err.ts│  │  json-log.ts │  │   (extensible) │  │
│  │Plain text →  │  │ Error lines  │  │ Structured   │  │                │  │
│  │structured    │  │  → parsed    │  │  JSON tool   │  │                │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────────────┘  │
└─────────┼─────────────────┼─────────────────┼──────────────────────────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LOG TAILER (src/server/services/)                       │
│                    Real-time file watching + parsing                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  • watchFile() on each log source (2-second polling interval)               │
│  • Tracks file offsets for resumption after rotation                        │
│  • Batch processing: up to 500 entries per batch                            │
│  • Handles log rotation: resets offset when file shrinks                    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT BUS + SSE (Real-time Layer)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐    ┌────────────────┐    ┌─────────────────────────┐    │
│  │   Event Bus    │◄───│  Log Entries   │    │    SSE /events          │    │
│  │  (pub/sub)     │    │  Tool Calls    │────│  Server-Sent Events     │    │
│  │                │    │  Health Stats  │    │  • Heartbeat: 30s       │    │
│  │subscribe()     │    │  Agent Updates │    │  • Auto-cleanup on      │    │
│  │broadcast()     │    │                │    │    client disconnect    │    │
│  └────────────────┘    └────────────────┘    └─────────────────────────┘    │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────────┐
│      SQLITE (bun:sqlite)      │   │           WEB CLIENT (React)            │
│   ┌───────────────────────┐   │   │  ┌─────────────────────────────────┐   │
│   │     log_entries       │   │   │  │     useSSE() hook               │   │
│   │  ├─ id, timestamp     │   │   │  │  ├─ Auto-reconnect               │   │
│   │  ├─ level, source     │   │   │  │  ├─ Event type routing           │   │
│   │  ├─ message, metadata │   │   │  │  └─ Connection state mgmt        │   │
│   │  └─ FTS5 virtual      │   │   │  └─────────────────────────────────┘   │
│   │     table for search  │   │   │                                         │
│   ├───────────────────────┤   │   │  ┌─────────────────────────────────┐   │
│   │     tool_calls        │   │   │  │  Views: Agents, Sessions, Logs  │   │
│   │  ├─ tool_name, agent  │   │   │  │  Crons, Errors, Models, Sprites │   │
│   │  ├─ duration_ms       │   │   │  │                                 │   │
│   │  └─ success, metadata │   │   │  │  Each view consumes typed       │   │
│   ├───────────────────────┤   │   │  │  API responses + SSE updates    │   │
│   │  health_snapshots     │   │   │  └─────────────────────────────────┘   │
│   │  ├─ channels (JSON)   │   │   │                                         │
│   │  ├─ agents (JSON)     │   │   └─────────────────────────────────────────┘
│   │  └─ sessions (JSON)   │   │
│   └───────────────────────┘   │
└───────────────────────────────┘
```

---

## Collector Pattern

Collectors are pure functions that gather data from external sources. They live in `src/server/collectors/` and are invoked by API routes.

| Collector | Source | Purpose | Cacheable |
|-----------|--------|---------|-----------|
| `health.ts` | Gateway HTTP (HEAD /) | Gateway reachability | No (real-time) |
| `sessions.ts` | `~/.openclaw/agents/*/sessions/sessions.json` | Active sessions | No |
| `agents.ts` | Session files + health probe | Agent status dashboard | No |
| `agent-detail.ts` | Agent workspace + gateway API | Detailed agent info | No |
| `cron.ts` | `~/.openclaw/crons/` + gateway API | Scheduled jobs | No |
| `models.ts` | Gateway API (`/models`) | Available LLMs | Yes (5min) |
| `sprites.ts` | `~/.openclaw/workspace/` | Sprite fleet status | No |

**Design Principles:**
- **No caching by default**: Data is fetched fresh on every API call
- **Fail-soft**: Return partial data rather than error (e.g., `health.ts` returns "unreachable" instead of throwing)
- **Typed strictly**: All collectors return strongly-typed data matching `src/shared/types.ts`

---

## Database Schema Rationale

### SQLite with bun:sqlite

We chose SQLite over PostgreSQL/MySQL because:
- **Single-file deployment**: No separate server process
- **Bun-native**: `bun:sqlite` is optimized for our runtime
- **FTS5 full-text search**: Built-in, no external dependencies
- **WAL mode**: `PRAGMA journal_mode = WAL` for concurrent reads during writes

### Schema Decisions

```sql
-- Retention: Prune to config.maxLogEntries (default 100K)
-- After each batch insert, oldest entries are deleted

-- FTS5 for log search without external indexing service
CREATE VIRTUAL TABLE log_entries_fts USING fts5(
  message,
  content='log_entries',
  content_rowid='id'
);

-- Triggers keep FTS index in sync automatically
CREATE TRIGGER log_entries_ai AFTER INSERT ON log_entries BEGIN
  INSERT INTO log_entries_fts(rowid, message) VALUES (new.id, new.message);
END;
```

**Trade-offs:**
- SQLite handles 100K log entries comfortably; beyond that, consider partitioning by date
- FTS5 query syntax is sanitized to prevent operator injection (see `log-store.ts`)
- No foreign keys needed — data is append-only with occasional pruning

---

## Real-Time Architecture

### SSE (Server-Sent Events)

Route: `GET /api/events`

```typescript
// Client subscribes via EventSource
const es = new EventSource('/api/events');
es.addEventListener('log_entry', (e) => {
  const entry = JSON.parse(e.data);
  // Update React state
});
```

**Heartbeat**: Every 30 seconds to keep NAT/firewall connections alive.

**Event Types**:
- `connected` — Initial connection ACK
- `heartbeat` — 30s keepalive
- `health` — Gateway status change
- `sessions` — New/closed session
- `log_entry` — New log line available
- `error` — Runtime error notification

### Event Bus

Simple pub/sub for decoupling:

```typescript
// In log-tailer: New entries parsed
broadcast({ type: 'log_entry', data: entry, timestamp: Date.now() });

// In SSE route: Forward to all connected clients
subscribe((event) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
});
```

**Why not WebSockets?**
- SSE is unidirectional (server → client) — fits our use case
- Built on HTTP: works through proxies, auto-reconnects
- Simpler mental model: one long-lived request per client

---

## Security & Isolation

### Log Parsing Safety

```typescript
// json-log.ts: Safely handles malformed JSON
try {
  const parsed = JSON.parse(trimmed);
  // ...process
} catch {
  return null; // Silently skip unparseable lines
}

// log-store.ts: Sanitize FTS5 queries
const sanitized = q.replace(/[^a-zA-Z0-9\s._/]/g, "").trim();
// Removes: - + * ^ ~ ( ) : " ' { }
```

### CORS & Headers

- CORS restricted to `localhost:5173` (dev) + server port
- Security headers via `hono/secure-headers` (CSP disabled for local HTTP)
- No authentication: runs on localhost only

---

## Development Patterns

### Testing Strategy

| Layer | Target | Approach |
|-------|--------|----------|
| Parsers | 95%+ | Unit tests with sample log lines |
| Services | 80%+ | Mock SQLite + file system |
| Routes | 75%+ | Hono test client, supertest-style |
| E2E | Critical paths | Playwright |

### Quality Gates

```bash
# Pre-commit (lefthook)
ESLint + Prettier + typecheck

# Pre-push (lefthook)
Full test suite + build

# CI (GitHub Actions)
lint + typecheck + test + build + Cerberus AI review
```

---

## Deployment

### Production Build

```bash
bun run build    # Vite (client) + tsc (server)
bun run start    # Production server on port 18790
```

### File System Dependencies

Cortex expects these paths (configurable via env):
- `~/.openclaw/logs/gateway.log` — Gateway events
- `~/.openclaw/logs/gateway.err.log` — Gateway errors
- `/tmp/openclaw/openclaw-YYYY-MM-DD.log` — JSON tool-call logs
- `~/.openclaw/agents/*/sessions/sessions.json` — Session metadata
- `~/.openclaw/crons/` — Cron job definitions
- `./data/cortex.db` — SQLite database (created on first run)

---

## Future Extension Points

1. **Additional Parsers**: Add to `src/server/parsers/`, register in `log-tailer.ts`
2. **New Collectors**: Implement collector function, wire to API route
3. **Custom SSE Events**: Broadcast from anywhere via `event-bus.ts`
4. **Metrics Export**: Query `log_entries` for Prometheus-style metrics

---

## See Also

- [`CLAUDE.md`](../CLAUDE.md) — Development guide
- [`src/shared/types.ts`](../src/shared/types.ts) — Type definitions
- [`migrations/001_initial.sql`](../migrations/001_initial.sql) — Database schema
