# Cortex v2

Real-time observability dashboard for [OpenClaw](https://github.com/misty-step/openclaw) gateway. Monitors agent health, sessions, logs, cron jobs, and model status.

## Setup

```bash
bun install
bun run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:18790

## Tech Stack

- **Server**: Hono + Bun + SQLite (bun:sqlite + FTS5)
- **Client**: React 19 + Vite + Tailwind CSS v4
- **Testing**: Vitest + Playwright
- **CI/CD**: GitHub Actions + Cerberus AI review

## Development

```bash
bun run validate    # Run all quality checks
bun run test:watch  # TDD workflow
```

See [CLAUDE.md](./CLAUDE.md) for full development guide.
