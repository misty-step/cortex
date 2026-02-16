import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { relativeTime } from "../lib/formatters";
import type { PaginatedResponse } from "../../shared/types";

export function Crons() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const params = new URLSearchParams({ limit: "10000" });
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  const url = `/api/crons?${params.toString()}`;
  const { data, loading, error } = useApi<PaginatedResponse<Record<string, unknown>>>(url);

  // Server handles text search via ?q=; status filter is client-side only
  const filteredCrons = useMemo(() => {
    if (!data || error) return [];
    const crons = data.data;
    if (!statusFilter) return crons;
    return crons.filter((c) => c.status === statusFilter || c.last_status === statusFilter);
  }, [data, error, statusFilter]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load cron jobs</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Cron Jobs ({filteredCrons.length})</h2>
        <div className="flex items-center gap-2">
          {filteredCrons.length > 0 && <ExportButton data={filteredCrons} filename="crons" />}
          <SearchBar
            onDebouncedSearch={setSearchQuery}
            placeholder="Search crons..."
            className="w-auto"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--bg2)] border rounded px-2 py-1"
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="ok">Last Run OK</option>
            <option value="error">Last Run Error</option>
          </select>
        </div>
      </div>
      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            render: (v, row) => (
              <div>
                <div className="font-medium">{String(v)}</div>
                <div className="text-xs text-[var(--fg3)] font-mono">
                  {String(row.id ?? "").slice(0, 8)}
                </div>
              </div>
            ),
          },
          { key: "agent_id", header: "Agent", sortable: true },
          {
            key: "schedule",
            header: "Schedule",
            sortable: false,
            render: (v: string) => (
              <code className="text-xs bg-[var(--bg2)] px-1 rounded">{v}</code>
            ),
          },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (v: string) => <StatusBadge status={v} />,
          },
          {
            key: "last_status",
            header: "Last Run",
            sortable: true,
            getSortValue: (_v, row) =>
              row.last_run ? new Date(row.last_run as string).getTime() : 0,
            render: (v, row) => (
              <div>
                <StatusBadge status={v === "ok" ? "ok" : v === "error" ? "error" : "warn"} />
                <div className="text-xs text-[var(--fg3)] mt-1">
                  {row.last_run ? relativeTime(new Date(row.last_run as string).getTime()) : "—"}
                </div>
              </div>
            ),
          },
          {
            key: "next_run",
            header: "Next Run",
            render: (v) => (
              <div className="text-sm">
                {v ? relativeTime(new Date(v as string).getTime()) : "\u2014"}
              </div>
            ),
          },
        ]}
        data={filteredCrons}
        rowKey="id"
      />
    </div>
  );
}
