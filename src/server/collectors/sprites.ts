import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SpriteStatus } from "../../shared/types.js";

const execFileAsync = promisify(execFile);

const SPRITE_NAMES = [
  "bramble",
  "cadence-ui",
  "clover",
  "fern",
  "moss",
  "sage",
  "thistle",
  "thorn",
];

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface ProcessInfo {
  pid: string;
  cmd: string;
}

interface SessionMeta {
  task?: string;
  createdAt?: number;
  updatedAt?: number;
  systemSent?: boolean;
}

async function getSpriteProcesses(): Promise<ProcessInfo[]> {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-af", "claude|codex|node.*sprite"], {
      timeout: 5000,
    });
    return stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+)$/);
        return match ? { pid: match[1]!, cmd: match[2]! } : { pid: "0", cmd: line };
      });
  } catch {
    return [];
  }
}

async function getSpriteList(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync("sprite", ["list"], { timeout: 15000 });
    return stdout
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("name"))
      .map((line) => line.split(/\s+/)[0]!)
      .filter(Boolean);
  } catch {
    // Fallback to known sprite names if command fails
    return SPRITE_NAMES;
  }
}

async function readSpriteSession(
  openclawHome: string,
  spriteName: string,
): Promise<SessionMeta | null> {
  // Map sprite names to agent IDs (usually same, but handle special cases)
  const agentId = spriteName === "cadence-ui" ? "cadence" : spriteName;
  const sessionsFile = path.join(openclawHome, "agents", agentId, "sessions", "sessions.json");

  try {
    const content = await fs.readFile(sessionsFile, "utf-8");
    const sessions = JSON.parse(content) as Record<string, SessionMeta>;

    // Find the most recently active session
    const sessionEntries = Object.entries(sessions);
    if (sessionEntries.length === 0) return null;

    // Sort by updatedAt descending
    sessionEntries.sort((a, b) => (b[1].updatedAt ?? 0) - (a[1].updatedAt ?? 0));
    return sessionEntries[0]![1];
  } catch {
    return null;
  }
}

function determineStatus(
  agentCount: number,
  session: SessionMeta | null,
  now: number,
): SpriteStatus["status"] {
  if (agentCount > 0) return "running";
  if (!session) return "idle";

  const lastActivity = session.updatedAt ?? session.createdAt ?? 0;
  const isStale = now - lastActivity > STALE_THRESHOLD_MS;

  if (session.systemSent && !isStale) return "complete";
  if (isStale) return "stale";
  return "idle";
}

function calculateRuntime(session: SessionMeta | null): number | null {
  if (!session?.createdAt) return null;
  const created = session.createdAt;
  const ended = session.updatedAt ?? Date.now();
  return Math.floor((ended - created) / 1000);
}

export async function collectSprites(openclawHome: string): Promise<SpriteStatus[]> {
  const now = Date.now();
  const [spriteNames, processes] = await Promise.all([getSpriteList(), getSpriteProcesses()]);

  const sprites = await Promise.all(
    spriteNames.map(async (name) => {
      const agentCount = processes.filter((p) => p.cmd.includes(name)).length;
      const session = await readSpriteSession(openclawHome, name);
      const status = determineStatus(agentCount, session, now);

      // A sprite is "dead" if it has no processes but has a stale incomplete session
      const finalStatus: SpriteStatus["status"] =
        status === "stale" && !session?.systemSent ? "dead" : status;

      return {
        name,
        status: finalStatus,
        agent_count: agentCount,
        last_seen: session?.updatedAt ? new Date(session.updatedAt).toISOString() : null,
        assigned_task: session?.task || null,
        runtime_seconds: calculateRuntime(session),
      };
    }),
  );

  // Sort: running first, then by name
  return sprites.sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return a.name.localeCompare(b.name);
  });
}
