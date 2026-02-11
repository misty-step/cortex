import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { parseMergeReadyLines } from "../lib/parseMergeReady";

type FactoryFleetRow = {
  name?: string;
  state?: string;
  task?: string;
  dispatchedAt?: string | number | null;
  elapsedMin?: number | string | null;
  branch?: string | null;
  commits?: number | string | null;
  stale?: boolean | string | null;
  blockedReason?: string | null;
  [k: string]: unknown;
};

type FactoryResponse = {
  needsAttention?: number | boolean | string | null;
  notifications?: unknown;
  fleet?:
    | {
        summary?: unknown;
        sprites?: FactoryFleetRow[];
        rows?: FactoryFleetRow[];
      }
    | FactoryFleetRow[];
  prs?: {
    summary?: unknown;
    mergeReady?: string | null;
    merge_ready?: string | null;
    openByRepo?: Record<string, unknown>;
    open_by_repo?: Record<string, unknown>;
    openPrsByRepo?: Record<string, unknown>;
    open_prs_by_repo?: Record<string, unknown>;
  };
  [k: string]: unknown;
};

function formatCardValue(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return `${v.length}`;
  try {
    const s = JSON.stringify(v);
    return s.length > 140 ? `${s.slice(0, 137)}...` : s;
  } catch {
    return String(v);
  }
}

function asNotificationsLines(v: unknown): string[] {
  if (!v) return [];

  if (Array.isArray(v)) {
    return v
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  if (typeof v === "string") {
    return v
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  if (typeof v === "object") {
    const maybe = v as { items?: unknown; lines?: unknown; notifications?: unknown };
    const items = maybe.items ?? maybe.lines ?? maybe.notifications;
    return asNotificationsLines(items);
  }

  return [];
}

function formatDispatchedAt(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toISOString();
  }
  return String(v);
}

function formatBool(v: unknown): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "-";
  return String(v);
}

function extractFleetRows(data: FactoryResponse | null): FactoryFleetRow[] {
  if (!data?.fleet) return [];
  if (Array.isArray(data.fleet)) return data.fleet;

  if (typeof data.fleet === "object" && data.fleet && !Array.isArray(data.fleet)) {
    if (Array.isArray(data.fleet.sprites)) return data.fleet.sprites;
    if (Array.isArray(data.fleet.rows)) return data.fleet.rows;
  }

  return [];
}

function extractMergeReadyRaw(prs: FactoryResponse["prs"]): string | null {
  if (!prs) return null;
  if (typeof prs.mergeReady === "string") return prs.mergeReady;
  if (typeof prs.merge_ready === "string") return prs.merge_ready;
  return null;
}

function extractOpenByRepo(prs: FactoryResponse["prs"]): Record<string, number> {
  const candidates = [
    prs?.openByRepo,
    prs?.open_by_repo,
    prs?.openPrsByRepo,
    prs?.open_prs_by_repo,
  ];

  for (const c of candidates) {
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const out: Record<string, number> = {};
    for (const [repo, count] of Object.entries(c)) {
      const n =
        typeof count === "number" ? count : typeof count === "string" ? Number(count) : Number.NaN;
      if (!Number.isNaN(n)) out[repo] = n;
    }
    if (Object.keys(out).length) return out;
  }

  // Fallback: heartbeat payloads include per-repo PR arrays.
  // Count any array-valued fields on `prs` (excluding mergeReady/summary).
  if (prs && typeof prs === "object") {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(prs)) {
      if (k === "summary" || k === "mergeReady" || k === "merge_ready") continue;
      if (Array.isArray(v)) out[k] = v.length;
    }
    if (Object.keys(out).length) return out;
  }

  return {};
}

export function Factory() {
  const [data, setData] = useState<FactoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/factory");
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        // Keep as text
      }

      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "error" in json
            ? String((json as { error?: unknown }).error ?? `HTTP ${res.status}`)
            : `HTTP ${res.status}`;
        setError(msg);
        setData(null);
        return;
      }

      if (typeof json !== "object" || !json) {
        setError("Invalid response shape from /api/factory");
        setData(null);
        return;
      }

      setData(json as FactoryResponse);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch /api/factory");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const notificationsLines = useMemo(() => asNotificationsLines(data?.notifications), [data]);
  const fleetRows = useMemo(() => extractFleetRows(data), [data]);
  const mergeReadyLines = useMemo(
    () => parseMergeReadyLines(extractMergeReadyRaw(data?.prs)),
    [data],
  );

  const openByRepo = useMemo(() => extractOpenByRepo(data?.prs), [data]);
  const openByRepoRows = useMemo(
    () =>
      Object.entries(openByRepo)
        .map(([repo, open]) => ({ repo, open }))
        .sort((a, b) => b.open - a.open || a.repo.localeCompare(b.repo)),
    [openByRepo],
  );

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[var(--fg)]">Factory</h2>
        <button
          type="button"
          onClick={load}
          className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg2)] hover:bg-[var(--bg3)] text-[var(--fg)]"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-300 p-3 rounded">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--bg2)] p-4 rounded-lg">
              <div className="text-sm text-[var(--fg3)]">Needs Attention</div>
              <div className="text-2xl font-semibold text-[var(--fg)]">
                {formatCardValue(data.needsAttention)}
              </div>
            </div>
            <div className="bg-[var(--bg2)] p-4 rounded-lg">
              <div className="text-sm text-[var(--fg3)]">Fleet</div>
              <div className="text-sm font-medium text-[var(--fg)] break-words">
                {formatCardValue(
                  typeof data.fleet === "object" && data.fleet && !Array.isArray(data.fleet)
                    ? data.fleet.summary
                    : null,
                )}
              </div>
            </div>
            <div className="bg-[var(--bg2)] p-4 rounded-lg">
              <div className="text-sm text-[var(--fg3)]">PRs</div>
              <div className="text-sm font-medium text-[var(--fg)] break-words">
                {formatCardValue(data.prs?.summary)}
              </div>
            </div>
            <div className="bg-[var(--bg2)] p-4 rounded-lg">
              <div className="text-sm text-[var(--fg3)]">Notifications</div>
              <div className="text-2xl font-semibold text-[var(--fg)]">
                {notificationsLines.length
                  ? notificationsLines.length
                  : formatCardValue(data.notifications)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Fleet</h3>
            <DataTable
              columns={[
                { key: "name", header: "Name" },
                {
                  key: "state",
                  header: "State",
                  render: (v: unknown) => (
                    <StatusBadge status={typeof v === "string" && v ? v : "unknown"} />
                  ),
                },
                { key: "task", header: "Task" },
                {
                  key: "dispatchedAt",
                  header: "Dispatched At",
                  render: (v: unknown) => formatDispatchedAt(v),
                },
                { key: "elapsedMin", header: "Elapsed (min)" },
                { key: "branch", header: "Branch" },
                { key: "commits", header: "Commits" },
                {
                  key: "stale",
                  header: "Stale",
                  render: (v: unknown) => formatBool(v),
                },
                { key: "blockedReason", header: "Blocked Reason" },
              ]}
              data={fleetRows}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">PRs</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[var(--bg2)] rounded-lg p-4 border border-[var(--border)]">
                <div className="text-sm font-semibold text-[var(--fg2)] mb-2">Merge Ready</div>
                {mergeReadyLines.length ? (
                  <ul className="space-y-1">
                    {mergeReadyLines.map((line) => (
                      <li key={line} className="text-[var(--fg)]">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[var(--fg3)]">No merge-ready PRs</div>
                )}
              </div>

              <div className="bg-[var(--bg2)] rounded-lg p-4 border border-[var(--border)]">
                <div className="text-sm font-semibold text-[var(--fg2)] mb-2">Open PRs By Repo</div>
                <DataTable
                  columns={[
                    { key: "repo", header: "Repo" },
                    { key: "open", header: "Open PRs" },
                  ]}
                  data={openByRepoRows}
                />
              </div>
            </div>
          </div>

          {notificationsLines.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Notifications</h3>
              <div className="bg-[var(--bg2)] rounded-lg p-4 border border-[var(--border)]">
                <ul className="space-y-1">
                  {notificationsLines.map((line) => (
                    <li key={line} className="text-[var(--fg)]">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
