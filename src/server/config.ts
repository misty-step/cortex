import path from "node:path";
import * as fs from "node:fs";

const HOME = process.env.HOME ?? "/tmp";

export function validatePort(
  name: string,
  value: string | undefined,
  defaultValue: number,
): number {
  const str = value ?? String(defaultValue);
  const num = parseInt(str, 10);

  if (isNaN(num) || num < 1 || num > 65535) {
    throw new Error(`Invalid ${name}: "${str}". Must be a number between 1 and 65535.`);
  }

  return num;
}

export function validatePath(name: string, value: string): string {
  // Warn if the path or its parent directory doesn't exist
  const dir = path.dirname(value);
  if (!fs.existsSync(dir)) {
    console.warn(`[cortex config] Warning: ${name} parent directory does not exist: ${dir}`);
  } else if (!fs.existsSync(value)) {
    // For directories (not files), warn if the directory itself doesn't exist
    const stats = fs.statSync(dir);
    if (!stats.isDirectory()) {
      console.warn(`[cortex config] Warning: ${name} parent path is not a directory: ${dir}`);
    }
  }
  return value;
}

const port = validatePort("CORTEX_PORT", process.env.CORTEX_PORT, 18790);
const allowedOrigins = process.env.CORTEX_ALLOWED_ORIGINS
  ? process.env.CORTEX_ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [`http://localhost:${port}`, "http://localhost:5173"];
const gatewayPort = validatePort("GATEWAY_PORT", process.env.GATEWAY_PORT, 18789);
const openclawHome = process.env.OPENCLAW_HOME ?? path.join(HOME, ".openclaw");
const logDir = process.env.OPENCLAW_LOG_DIR ?? "/tmp/openclaw";
const dbPath = process.env.CORTEX_DB_PATH ?? path.join(HOME, ".cortex", "cortex.db");

// Validate paths at startup
validatePath("OPENCLAW_HOME", openclawHome);
validatePath("OPENCLAW_LOG_DIR", logDir);
validatePath("CORTEX_DB_PATH", dbPath);

export const config = {
  port,
  gatewayPort,
  openclawHome,
  logDir,
  pollIntervalFast: 10_000,
  pollIntervalSlow: 30_000,
  dbPath,
  maxLogEntries: 10_000,
  maxErrors: 1_000,
  allowedOrigins,
} as const;
