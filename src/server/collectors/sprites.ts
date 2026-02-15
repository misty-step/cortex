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
const CACHE_TTL_MS = 8000; // 8 seconds cache for polled endpoint
const MAX_SESSION_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

// In-memory cache for collectSprites to prevent N+1 parsing on every poll
let spritesCache: { data: SpriteStatus[]; timestamp: number } | null = null;

// Pending promise to prevent cache stampede - coalesces concurrent requests
let pendingPromise: Promise<SpriteStatus[]> | null = null;

// Session file cache with mtime-based invalidation
interface SessionCacheEntry {
  mtime: number;
  session: SessionMeta | null;
}
const sessionCache = new Map<string, SessionCacheEntry>();

// Export for testing
export function clearSpritesCache(): void {
  spritesCache = null;
  pendingPromise = null;
  sessionCache.clear();
}

// Escape regex special characters in sprite names
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
    // Reduced timeout from 15s to 5s to stay within polling interval (10s)
    const { stdout } = await execFileAsync("sprite", ["list"], { timeout: 5000 });
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
  // NOTE: cadence-ui sprite maps to "cadence" agent directory (legacy naming)
  const agentId = spriteName === "cadence-ui" ? "cadence" : spriteName;
  const sessionsFile = path.join(openclawHome, "agents", agentId, "sessions", "sessions.json");

  try {
    // Check file size BEFORE reading to prevent OOM from large files
    let stat;
    let fileMtime: number | undefined;
    let fileSize: number | undefined;
    try {
      stat = await fs.stat(sessionsFile);
      fileMtime = stat.mtimeMs;
      fileSize = stat.size;
    } catch (statErr) {
      // If stat fails (e.g., file doesn't exist), try reading anyway - may be a new file

      const _ = statErr;
    }

    // Defensive: handle cases where stat might not have expected properties
    if (typeof fileSize === "number" && fileSize > MAX_SESSION_FILE_SIZE) {
      return null;
    }

    // Check mtime cache to avoid re-reading unchanged files
    // Only use cache if we have a valid mtime
    const cached = sessionCache.get(sessionsFile);
    if (cached && typeof fileMtime === "number" && cached.mtime === fileMtime) {
      return cached.session;
    }

    // Read and parse the file
    const content = await fs.readFile(sessionsFile, "utf-8");
    const sessions = JSON.parse(content) as Record<string, SessionMeta>;

    // Single-pass O(N) to find the most recently active session
    let latest: SessionMeta | null = null;
    let latestTime = -1;
    for (const meta of Object.values(sessions)) {
      const t = meta.updatedAt ?? meta.createdAt ?? 0;
      if (t > latestTime) {
        latestTime = t;
        latest = meta;
      }
    }

    // Update cache with new mtime if available
    if (typeof fileMtime === "number") {
      sessionCache.set(sessionsFile, { mtime: fileMtime, session: latest });
    }
    return latest;
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

  // Complete only applies to recent sessions (< 5min old)
  // A stale completed session should show as stale/dead, not complete
  if (session.systemSent && !isStale) return "complete";
  if (isStale) return "stale";
  return "idle";
}

function calculateRuntime(session: SessionMeta | null): number | null {
  if (!session?.createdAt) return null;
  const created = session.createdAt;
  if (!session.updatedAt) return null;
  // Guard against negative values from clock skew or corrupted data
  const runtime = Math.floor((session.updatedAt - created) / 1000);
  return runtime >= 0 ? runtime : null;
}

export async function collectSprites(openclawHome: string): Promise<SpriteStatus[]> {
  // Check cache first to avoid expensive collection on every poll
  const now = Date.now();
  if (spritesCache && now - spritesCache.timestamp < CACHE_TTL_MS) {
    return spritesCache.data;
  }

  // If a collection is already in progress, wait for it instead of starting another
  // This prevents cache stampede when multiple requests hit an expired cache
  if (pendingPromise) {
    return pendingPromise;
  }

  // Start new collection and store the promise to coalesce concurrent requests
  pendingPromise = doCollectSprites(openclawHome, now);
  try {
    const result = await pendingPromise;
    spritesCache = { data: result, timestamp: Date.now() };
    return result;
  } finally {
    pendingPromise = null;
  }
}

async function doCollectSprites(openclawHome: string, now: number): Promise<SpriteStatus[]> {
  const [spriteNames, processes] = await Promise.all([getSpriteList(), getSpriteProcesses()]);

  // Pre-compile regexes once for all sprites, escaping special regex characters
  const namePatterns = new Map(spriteNames.map((n) => [n, new RegExp(`\\b${escapeRegex(n)}\\b`)]));

  // Single-pass O(N) process counting using a Map instead of O(N*M) filtering
  const agentCounts = new Map<string, number>();
  for (const process of processes) {
    // Iterate over Map directly to avoid unnecessary array allocation
    for (const [name, pattern] of namePatterns) {
      if (pattern.test(process.cmd)) {
        agentCounts.set(name, (agentCounts.get(name) ?? 0) + 1);
      }
    }
  }

  const sprites = await Promise.all(
    spriteNames.map(async (name) => {
      const agentCount = agentCounts.get(name) ?? 0;
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
