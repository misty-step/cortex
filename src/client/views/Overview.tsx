import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { filterByText, relativeTime } from "../lib/formatters";
import type { ExecApprovalSummary } from "../../shared/types";

export function Overview() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const {
    data: health,
    loading: healthLoading,
    error: healthError,
  } = useApi<Record<string, unknown>>("/api/health");
  const {
    data: sprites,
    loading: spritesLoading,
    error: spritesError,
  } = useApi<Record<string, unknown>[]>("/api/sprites");
  const { data: approvals } = useApi<ExecApprovalSummary>("/api/approvals");

  const spriteList = useMemo(() => sprites ?? [], [sprites]);
  const runningSprites = spriteList.filter((s) => s.status === "running").length;
  const idleSprites = spriteList.filter((s) => s.status === "idle").length;

  // Apply status filter, then text search
  const filteredSprites = useMemo(() => {
    const byStatus = statusFilter
      ? spriteList.filter((s) => s.status === statusFilter)
      : spriteList;
    return filterByText(byStatus, searchQuery, ["name"]);
  }, [spriteList, statusFilter, searchQuery]);

  if (healthLoading || spritesLoading) return <div className="p-4">Loading...</div>;
  if (healthError || spritesError)
    return <div className="p-4 text-red-500">Failed to load overview data</div>;

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[var(--fg)]">Factory Overview</h2>
        {filteredSprites.length > 0 && <ExportButton data={filteredSprites} filename="sprites" />}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Gateway</div>
          <div className="text-2xl font-semibold">
            <StatusBadge status={String(health?.status ?? "unknown")} />
          </div>
        </div>
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Running Sprites</div>
          <div className="text-2xl font-semibold text-green-500">{runningSprites}</div>
        </div>
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Idle Sprites</div>
          <div className="text-2xl font-semibold text-yellow-500">{idleSprites}</div>
        </div>
        <div
          className={`p-4 rounded-lg ${
            approvals && approvals.totalPending > 0
              ? "bg-yellow-900/30 border border-yellow-600/40"
              : "bg-[var(--bg2)]"
          }`}
        >
          <div className="text-sm text-[var(--fg3)]">Pending Approvals</div>
          <div
            className={`text-2xl font-semibold ${
              approvals && approvals.totalPending > 0 ? "text-yellow-400" : "text-[var(--fg3)]"
            }`}
          >
            {approvals?.totalPending ?? 0} Pending
          </div>
          {approvals && approvals.pending.length > 0 && (
            <div className="mt-2 space-y-1">
              {approvals.pending.slice(0, 3).map((a) => (
                <div key={a.id} className="text-xs text-[var(--fg3)] truncate">
                  <span className="text-[var(--fg2)]">{a.agentId ?? "unknown"}</span>
                  {" — "}
                  <span className="font-mono">{a.command.slice(0, 60)}</span>
                  <span className="ml-1 opacity-60">{relativeTime(a.createdAtMs)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">Fleet Status</h3>
          <div className="flex items-center gap-2">
            <SearchBar
              onDebouncedSearch={setSearchQuery}
              placeholder="Search sprites..."
              className="w-auto"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[var(--bg2)] border rounded px-2 py-1 text-sm"
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              <option value="running">Running</option>
              <option value="idle">Idle</option>
            </select>
          </div>
        </div>
        <DataTable
          columns={[
            { key: "name", header: "Sprite", sortable: true },
            {
              key: "status",
              header: "Status",
              sortable: true,
              render: (v: string) => <StatusBadge status={v} />,
            },
            {
              key: "agent_count",
              header: "Agents",
              sortable: true,
              getSortValue: (v) => Number(v) || 0,
            },
            { key: "last_seen", header: "Last Seen", sortable: true },
          ]}
          data={filteredSprites}
        />
      </div>
    </div>
  );
}
