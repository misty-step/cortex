import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { Pagination } from "../components/Pagination";
import { MarkdownContent } from "../components/MarkdownContent";
import type { LogEntry, PaginatedResponse } from "../../shared/types";

export function Logs() {
  const [level, setLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  const url = qs ? `/api/logs?${qs}` : "/api/logs";
  const { data, loading, error } = useApi<PaginatedResponse<LogEntry>>(url);

  const logs = useMemo<LogEntry[]>(() => {
    if (!data || error) return [];
    return data.data;
  }, [data, error]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load logs</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gateway Logs</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && <ExportButton data={logs} filename="logs" />}
          <SearchBar
            onDebouncedSearch={(q) => {
              setSearchQuery(q);
              setPage(1);
            }}
            placeholder="Search logs..."
            className="w-auto"
          />
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
            className="bg-[var(--bg2)] border rounded px-2 py-1"
            aria-label="Filter by level"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>
      <DataTable
        columns={[
          { key: "timestamp", header: "Time", sortable: true },
          { key: "level", header: "Level", sortable: true },
          {
            key: "message",
            header: "Message",
            sortable: false,
            render: (v: string) =>
              v && v.length > 80 ? <MarkdownContent content={v} /> : (v ?? "—"),
          },
        ]}
        data={logs}
      />
      {data && (
        <Pagination
          page={data.page}
          total={data.total}
          limit={data.limit}
          hasMore={data.hasMore}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
