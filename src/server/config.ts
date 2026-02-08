import path from "node:path";

const HOME = process.env.HOME ?? "/tmp";

export const config = {
  port: parseInt(process.env.CORTEX_PORT ?? "18790", 10),
  gatewayPort: parseInt(process.env.GATEWAY_PORT ?? "18789", 10),
  openclawHome: process.env.OPENCLAW_HOME ?? path.join(HOME, ".openclaw"),
  logDir: process.env.OPENCLAW_LOG_DIR ?? "/tmp/openclaw",
  pollIntervalFast: 10_000,
  pollIntervalSlow: 30_000,
  dbPath: process.env.CORTEX_DB_PATH ?? path.join(HOME, ".cortex", "cortex.db"),
  maxLogEntries: 10_000,
  maxErrors: 1_000,
} as const;
