import { Hono } from "hono";
import { collectHealth } from "../collectors/health.js";
import { collectSessions } from "../collectors/sessions.js";
import { collectCrons } from "../collectors/cron.js";
import { collectModels } from "../collectors/models.js";
import { config } from "../config.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

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

// Logs (read from files directly)
api.get("/logs", async (c) => {
  const limit = parseInt(c.req.query("limit") || "100", 10);

  const logDir = path.join(config.openclawHome, "logs");
  const entries: { timestamp: string; level: string; source: string; message: string }[] = [];

  try {
    const gwLog = await fs.readFile(path.join(logDir, "gateway.log"), "utf-8").catch(() => "");
    const gwErr = await fs.readFile(path.join(logDir, "gateway.err.log"), "utf-8").catch(() => "");

    for (const line of gwLog.split("\n").filter((l) => l.trim())) {
      const match = line.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*\[([^\]]+)\]\s*(.+)$/,
      );
      if (match) {
        const time = match[1] ?? "";
        const subsystem = match[2] ?? "";
        const message = match[3] ?? "";
        const level = message.toLowerCase().includes("error")
          ? "error"
          : message.toLowerCase().includes("warn")
            ? "warn"
            : "info";
        if (!c.req.query("level") || level === c.req.query("level")) {
          entries.push({ timestamp: time, level, source: subsystem, message });
        }
      }
    }

    for (const line of gwErr.split("\n").filter((l) => l.trim())) {
      const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*(.+)$/);
      if (match) {
        const time = match[1] ?? "";
        const message = match[2] ?? "";
        entries.push({ timestamp: time, level: "error", source: "gateway", message });
      }
    }
  } catch {
    // Ignore errors
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

// Errors
api.get("/errors", async (c) => {
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const logDir = path.join(config.openclawHome, "logs");

  try {
    const content = await fs.readFile(path.join(logDir, "gateway.err.log"), "utf-8");
    const errors = content
      .split("\n")
      .filter((l) => l.trim())
      .slice(-limit)
      .map((line) => {
        const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z)\s*(.+)$/);
        return match
          ? { timestamp: match[1], level: "error", message: match[2] }
          : { timestamp: new Date().toISOString(), level: "error", message: line };
      });
    return c.json(errors.reverse());
  } catch {
    return c.json([]);
  }
});

// Sprites (via CLI)
api.get("/sprites", async (c) => {
  try {
    const { stdout } = await execAsync("sprite list", { timeout: 15000 });
    const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("name"));

    const { stdout: psOut } = await execAsync("ps aux | grep -E 'claude|codex' | grep -v grep", {
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
  } catch {
    return c.json([]);
  }
});

export { api };
