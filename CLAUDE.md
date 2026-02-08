# Cortex v2 — OpenClaw Observability Dashboard

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm dev              # Start Vite dev server (frontend, port 5173)
pnpm dev:server       # Start Hono server (API, port 18790)
pnpm dev:all          # Start both concurrently
```

## Essential Commands

```bash
# Development
pnpm dev              # Vite dev server with HMR
pnpm dev:server       # Hono API server with tsx watch
pnpm dev:all          # Both servers concurrently

# Quality
pnpm lint             # ESLint (flat config, zero warnings)
pnpm lint:fix         # ESLint with auto-fix
pnpm typecheck        # tsc --noEmit
pnpm format           # Prettier

# Testing
pnpm test             # Vitest (unit tests)
pnpm test:watch       # Vitest in watch mode
pnpm test:coverage    # Vitest with v8 coverage
pnpm test:e2e         # Playwright E2E tests

# Build
pnpm build            # Vite (client) + tsc (server)
pnpm start            # Run production server

# Validate all
pnpm validate         # typecheck + lint + test + build
```

## Architecture

### Server (`src/server/`)
- **Framework**: Hono on Node.js
- **Port**: 18790 (same as cortex.js MVP)
- **Database**: SQLite via better-sqlite3 with FTS5
- **Real-time**: SSE to browser clients

### Client (`src/client/`)
- **Framework**: React 19 + React Router
- **Build**: Vite
- **Styling**: Tailwind CSS v4

### Shared (`src/shared/`)
- Types used by both server and client

## Data Sources

1. **OpenClaw CLI**: `openclaw health`, `openclaw sessions`, etc.
2. **Log files**:
   - `/tmp/openclaw/openclaw-YYYY-MM-DD.log` (JSON, tool calls)
   - `~/.openclaw/logs/gateway.log` (plain text events)
   - `~/.openclaw/logs/gateway.err.log` (errors)
3. **Session files**: `~/.openclaw/agents/*/sessions/sessions.json`

## Ports

- Cortex frontend (dev): 5173
- Cortex API server: 18790
- OpenClaw Gateway: 18789

## Test Coverage Targets

| Layer | Target |
|-------|--------|
| Parsers (`src/server/parsers/`) | 95%+ |
| Services (`src/server/services/`) | 80%+ |
| Routes (`src/server/routes/`) | 75%+ |

## Quality Gates (3 layers)

1. **Pre-commit** (lefthook): ESLint + Prettier + typecheck
2. **Pre-push** (lefthook): Full test suite + build
3. **CI** (GitHub Actions): lint + typecheck + test + build + Cerberus review

## Key Conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`
- ESLint flat config (eslint.config.mjs)
- `no-console` enforced in client code, allowed in server
- Semantic commits via commitlint (`feat:`, `fix:`, `chore:`, etc.)
- pnpm only (enforced via `packageManager` field)
