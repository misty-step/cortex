# Cortex v2

Real-time observability dashboard for [OpenClaw](https://github.com/misty-step/openclaw) gateway. Monitors agent health, sessions, logs, cron jobs, and model status.

## Setup

```bash
pnpm install
pnpm dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:18790

## Tech Stack

- **Server**: Hono + Node.js + SQLite (better-sqlite3 + FTS5)
- **Client**: React 19 + Vite + Tailwind CSS v4
- **Testing**: Vitest + Playwright
- **CI/CD**: GitHub Actions + Cerberus AI review

## Development

```bash
pnpm validate    # Run all quality checks
pnpm test:watch  # TDD workflow
```

See [CLAUDE.md](./CLAUDE.md) for full development guide.
