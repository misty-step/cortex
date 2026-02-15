# Cortex API Documentation

REST API reference for the Cortex monitoring dashboard.

**Base URL:** `http://localhost:3000/api`

All responses are JSON. All list endpoints support pagination.

---

## Endpoints Overview

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Gateway health status |
| `/sessions` | GET | List active sessions |
| `/logs` | GET | Query logs from SQLite |
| `/errors` | GET | Query error-level logs |
| `/crons` | GET | List cron jobs |
| `/models` | GET | List available AI models |
| `/agents` | GET | List all agents |
| `/agents/:id` | GET | Get agent details |
| `/sprites` | GET | List Fly.io sprites |

---

## Common Parameters

### Pagination

All list endpoints support these query parameters:

| Param | Default | Range | Description |
|-------|---------|-------|-------------|
| `page` | 1 | 1-100,000 | Page number |
| `limit` | 100* | 1-10,000 | Items per page |

\* `/errors` defaults to 50.

### Search

Endpoints with search support a `q` parameter for filtering:

- `/sessions?q=amos` — Search by agent_id, session_key, or current_task
- `/crons?q=daily` — Search by name, agent_id, or schedule
- `/logs?q=error` — Search by log message content
- `/errors?q=timeout` — Search error logs by message

---

## GET /health

Check gateway connectivity status.

### Response

```json
{
  "status": "ok",
  "gateway": "reachable",
  "timestamp": 1707830400000
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | `"ok" \| "degraded" \| "error"` | Overall health status |
| `gateway` | `"reachable" \| "unreachable"` | Gateway connection state |
| `timestamp` | number | Unix timestamp (ms) |

---

## GET /sessions

List all active agent sessions.

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 100 | Items per page |
| `q` | — | Search query |

### Response

```json
{
  "data": [
    {
      "agent_id": "amos",
      "session_key": "agent:amos:main",
      "status": "active",
      "start_time": "2024-01-15T10:30:00Z",
      "last_activity": "2024-01-15T11:45:00Z",
      "current_task": "Reviewing PR #123",
      "model": "kimi-k2.5"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 100,
  "hasMore": false
}
```

### Session Fields

| Field | Type | Description |
|-------|------|-------------|
| `agent_id` | string | Agent identifier |
| `session_key` | string | Unique session key |
| `status` | string | `"active"` or `"idle"` |
| `start_time` | string \| null | ISO 8601 start timestamp |
| `last_activity` | string \| null | ISO 8601 last activity |
| `current_task` | string \| null | Current task description |
| `model` | string \| undefined | Active model ID |

---

## GET /logs

Query application logs from SQLite.

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 100 | Items per page |
| `level` | — | Filter: `error`, `warn`, `info`, `debug` |
| `q` | — | Search log messages |

### Response

```json
{
  "data": [
    {
      "id": 1,
      "timestamp": "2024-01-15T10:30:00Z",
      "level": "info",
      "source": "gateway-log",
      "message": "Session started",
      "raw": null,
      "metadata": { "agent": "amos" },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 100,
  "hasMore": true
}
```

### Log Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Log entry ID |
| `timestamp` | string | ISO 8601 timestamp |
| `level` | `LogLevel` | `error`, `warn`, `info`, `debug` |
| `source` | `LogSource` | `json-log`, `gateway-log`, `gateway-err` |
| `message` | string | Log message |
| `raw` | string \| null | Raw log line |
| `metadata` | object \| null | Structured metadata |

---

## GET /errors

Query error-level logs (convenience alias for `GET /logs?level=error`).

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 50 | Items per page |
| `q` | — | Search error messages |
| `source` | — | Filter: `json-log`, `gateway-log`, `gateway-err` |

### Response

Same shape as `/logs`, but `level` is always `"error"`.

---

## GET /crons

List scheduled cron jobs.

### Query Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 100 | Items per page |
| `q` | — | Search by name, agent_id, or schedule |

### Response

```json
{
  "data": [
    {
      "id": "cron-001",
      "name": "daily-backup",
      "agent_id": "system",
      "schedule": "0 0 * * *",
      "last_run": "2024-01-14T00:00:00Z",
      "next_run": "2024-01-15T00:00:00Z",
      "status": "active",
      "last_status": "success"
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 100,
  "hasMore": false
}
```

### Cron Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Cron job identifier |
| `name` | string | Human-readable name |
| `agent_id` | string | Owning agent |
| `schedule` | string | Cron expression |
| `last_run` | string \| null | Last execution time |
| `next_run` | string \| null | Next scheduled run |
| `status` | string | Job status |
| `last_status` | string | Last run result |

---

## GET /models

List available AI models.

### Response

```json
[
  {
    "id": "kimi-k2.5",
    "name": "Kimi K2.5",
    "provider": "moonshot",
    "status": "available"
  }
]
```

### Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Model identifier |
| `name` | string | Display name |
| `provider` | string | Provider (openrouter, anthropic, etc.) |
| `status` | string | `available`, `unavailable`, etc. |

---

## GET /agents

List all agents with status summary.

### Response

```json
[
  {
    "id": "amos",
    "name": "Amos",
    "online": true,
    "sessionCount": 3,
    "lastHeartbeat": "2024-01-15T11:45:00Z",
    "currentModel": "kimi-k2.5",
    "enabled": true
  }
]
```

### Agent Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Agent identifier |
| `name` | string | Display name |
| `online` | boolean | Currently connected |
| `sessionCount` | number | Active sessions |
| `lastHeartbeat` | string \| null | Last ping timestamp |
| `currentModel` | string \| null | Currently using model |
| `enabled` | boolean | Agent enabled flag |

---

## GET /agents/:id

Get detailed information about a specific agent.

### Path Parameters

| Param | Description |
|-------|-------------|
| `id` | Agent ID (alphanumeric with hyphens/underscores) |

### Response

```json
{
  "id": "amos",
  "name": "Amos",
  "online": true,
  "sessionCount": 3,
  "lastHeartbeat": "2024-01-15T11:45:00Z",
  "currentModel": "kimi-k2.5",
  "enabled": true,
  "workspace": "/home/user/.openclaw/workspace-amos",
  "model": {
    "primary": "kimi-k2.5",
    "fallbacks": ["gpt-4"]
  },
  "subagents": ["amos-research", "amos-code"],
  "availableModels": [
    {
      "id": "kimi-k2.5",
      "name": "Kimi K2.5",
      "provider": "moonshot",
      "reasoning": true,
      "contextWindow": 256000,
      "maxTokens": 8192
    }
  ],
  "authProfiles": [
    {
      "provider": "openrouter",
      "profileId": "default",
      "errorCount": 0,
      "lastUsed": 1707830400000,
      "lastFailure": null
    }
  ],
  "sessions": [
    {
      "key": "agent:amos:main",
      "updatedAt": 1707830400000,
      "model": "kimi-k2.5"
    }
  ],
  "skills": ["web_search", "github", "file_ops"]
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| `400` | Invalid agent ID format |
| `404` | Agent not found |

---

## GET /sprites

List Fly.io sprites and their current status.

### Response

```json
[
  {
    "name": "sprite-001",
    "status": "running",
    "agent_count": 2,
    "last_seen": "2024-01-15T11:45:00Z"
  },
  {
    "name": "sprite-002",
    "status": "idle",
    "agent_count": 0,
    "last_seen": null
  }
]
```

### Sprite Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Sprite identifier |
| `status` | `"running" \| "idle"` | Current state |
| `agent_count` | number | Active coding agents |
| `last_seen` | string \| null | ISO 8601 timestamp or null |

---

## Type Definitions

```typescript
// Log levels and sources
type LogLevel = "error" | "warn" | "info" | "debug";
type LogSource = "json-log" | "gateway-log" | "gateway-err";

// Paginated response wrapper
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
```

---

## Error Handling

All errors return a JSON response with an `error` field:

```json
{
  "error": "Agent not found"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request (invalid parameters) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## SSE Events

Cortex also provides Server-Sent Events at `/api/events` for real-time updates. See [SSE.md](./SSE.md) for details.
