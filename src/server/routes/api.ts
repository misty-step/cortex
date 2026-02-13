import { Hono } from "hono";
import { collectHealth } from "../collectors/health.js";
import { collectSessions } from "../collectors/sessions.js";
import { collectCrons } from "../collectors/cron.js";
import { collectModels } from "../collectors/models.js";
import { config } from "../config.js";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const execFileAsync = promisify(execFile);

const api = new Hono();

// Health check
api.get("/health", async (c) => {
  const health = await collectHealth(config.gatewayPort);
  return c.json(health);
});

// Sessions
api.get("/sessions", async (c) => {
  const sessions = await collectSessions(config.openclawHome);
  return c.json(sessions);
});

/** Read last N lines from a file using streaming (avoids OOM on large files). */
async function readTailLines(filePath: string, maxLines: number): Promise<string[]> {
  const lines: string[] = [];
  try {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      lines.push(line);
      if (lines.length > maxLines * 2) {
        // Keep a sliding window to avoid unbounded memory
        lines.splice(0, lines.length - maxLines);
      }
    }
  } catch {
    // File doesn't exist or is unreadable
  }
  return lines.slice(-maxLines);
}

function clampLimit(raw: string | undefined, fallback: number, max: number): number {
  const parsed = parseInt(raw || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

// Logs (streaming tail to avoid OOM on large files)
api.get("/logs", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 100, 10_000);
  const levelFilter = c.req.query("level");

  const logDir = path.join(config.openclawHome, "logs");
  const entries: Array<{ timestamp: string; level: string; source: string; message: string }> = [];

  try {
    const gwLines = await readTailLines(path.join(logDir, "gateway.log"), limit * 2);
    const errLines = await readTailLines(path.join(logDir, "gateway.err.log"), limit);

    for (const line of gwLines) {
      const match = line.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*\[([^\]]+)\]\s*(.+)$/,
      );
      if (match) {
        const time = match[1]!;
        const subsystem = match[2]!;
        const message = match[3] ?? "";
        const level = message.toLowerCase().includes("error")
          ? "error"
          : message.toLowerCase().includes("warn")
            ? "warn"
            : "info";
        if (!levelFilter || level === levelFilter) {
          entries.push({ timestamp: time, level, source: subsystem, message });
        }
      }
    }

    for (const line of errLines) {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*(.+)$/);
      if (match) {
        const time = match[1]!;
        const message = match[2]!;
        entries.push({ timestamp: time, level: "error", source: "gateway", message });
      }
    }
  } catch (err) {
    console.error("[api/logs] Failed to read log files:", err);
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return c.json(entries.slice(0, limit));
});

// Crons
api.get("/crons", async (c) => {
  const crons = await collectCrons(config.openclawHome);
  return c.json(crons);
});

// Models
api.get("/models", (c) => {
  const models = collectModels();
  return c.json(models);
});

// Errors (streaming tail)
api.get("/errors", async (c) => {
  const limit = clampLimit(c.req.query("limit"), 50, 10_000);
  const logDir = path.join(config.openclawHome, "logs");

  try {
    const lines = await readTailLines(path.join(logDir, "gateway.err.log"), limit);
    const errors = lines.map((line) => {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*(.+)$/);
      return match
        ? { timestamp: match[1], level: "error", message: match[2] }
        : { timestamp: new Date().toISOString(), level: "error", message: line };
    });
    return c.json(errors.reverse());
  } catch (err) {
    console.error("[api/errors] Failed to read error log:", err);
    return c.json([]);
  }
});

// Sprites (via CLI — uses execFile to prevent shell injection)
api.get("/sprites", async (c) => {
  try {
    const { stdout } = await execFileAsync("sprite", ["list"], { timeout: 15000 });
    const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("name"));

    const { stdout: psOut } = await execFileAsync("pgrep", ["-lf", "claude|codex"], {
      timeout: 5000,
    }).catch(() => ({ stdout: "" }));
    const psLines = psOut.split("\n").filter((l) => l.trim());

    const sprites = lines.map((line) => {
      const name = line.split(/\s+/)[0] || "unknown";
      const agentCount = psLines.filter((p) => p.includes(name)).length;
      return {
        name,
        status: agentCount > 0 ? "running" : "idle",
        agent_count: agentCount,
        last_seen: agentCount > 0 ? new Date().toISOString() : null,
      };
    });

    return c.json(sprites);
  } catch (err) {
    console.error("[api/sprites] Failed to collect sprite status:", err);
    return c.json([]);
  }
});

export { api };
