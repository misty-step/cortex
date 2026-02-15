import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PendingExecApproval, ExecApprovalSummary } from "../../shared/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApproval(entry: unknown): PendingExecApproval | null {
  if (!isRecord(entry)) return null;

  const id = typeof entry.id === "string" ? entry.id : null;
  if (!id) return null;

  const createdAtMs = typeof entry.createdAtMs === "number" ? entry.createdAtMs : 0;
  const expiresAtMs = typeof entry.expiresAtMs === "number" ? entry.expiresAtMs : 0;

  // Filter expired
  if (expiresAtMs > 0 && expiresAtMs < Date.now()) return null;

  const req = isRecord(entry.request) ? entry.request : {};

  return {
    id,
    agentId: typeof req.agentId === "string" ? req.agentId : null,
    sessionKey: typeof req.sessionKey === "string" ? req.sessionKey : null,
    command: typeof req.command === "string" ? req.command : "",
    cwd: typeof req.cwd === "string" ? req.cwd : null,
    createdAtMs,
    expiresAtMs,
  };
}

export async function collectApprovals(openclawHome: string): Promise<ExecApprovalSummary> {
  const filePath = path.join(openclawHome, "exec-approvals.json");

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || !Array.isArray(data.pending)) {
      return { pending: [], totalPending: 0 };
    }

    const pending: PendingExecApproval[] = [];
    for (const entry of data.pending) {
      const approval = parseApproval(entry);
      if (approval) pending.push(approval);
    }

    // Sort by creation time, newest first
    pending.sort((a, b) => b.createdAtMs - a.createdAtMs);

    return { pending, totalPending: pending.length };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { pending: [], totalPending: 0 };
    }
    console.error("[collector/approvals] Failed to read exec-approvals.json:", err);
    return { pending: [], totalPending: 0 };
  }
}
