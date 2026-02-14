# Cortex v2 — OpenClaw Observability Dashboard

## Quick Start

```bash
bun install              # Install dependencies
bun run dev              # Start Vite dev server (frontend, port 5173)
bun run dev:server       # Start Hono server (API, port 18790)
bun run dev:all          # Start both concurrently
```

## Essential Commands

```bash
# Development
bun run dev              # Vite dev server with HMR
bun run dev:server       # Hono API server with bun --watch
bun run dev:all          # Both servers concurrently

# Quality
bun run lint             # ESLint (flat config, zero warnings)
bun run lint:fix         # ESLint with auto-fix
bun run typecheck        # tsc --noEmit
bun run format           # Prettier

# Testing
bun run test             # Vitest (unit tests)
bun run test:watch       # Vitest in watch mode
bun run test:coverage    # Vitest with v8 coverage
bun run test:e2e         # Playwright E2E tests

# Build
bun run build            # Vite (client) + tsc (server)
bun run start            # Run production server

# Validate all
bun run validate         # typecheck + lint + test + build
```

## Architecture

### Server (`src/server/`)
- **Framework**: Hono on Bun
- **Port**: 18790 (same as cortex.js MVP)
- **Database**: SQLite via bun:sqlite with FTS5
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
- Bun only (enforced via `engines` field)
