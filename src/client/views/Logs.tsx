import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { MarkdownContent } from "../components/MarkdownContent";
import type { LogEntry } from "../../shared/types";

export function Logs() {
  const [level, setLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const params = new URLSearchParams();
  if (level) params.set("level", level);
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  const qs = params.toString();
  const url = qs ? `/api/logs?${qs}` : "/api/logs";
  const { data: raw, loading, error } = useApi<LogEntry[] | { data: LogEntry[] }>(url);

  const logs = useMemo<LogEntry[]>(() => {
    if (!raw || error) return [];
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  }, [raw, error]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load logs</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gateway Logs</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && <ExportButton data={logs} filename="logs" />}
          <SearchBar
            onDebouncedSearch={setSearchQuery}
            placeholder="Search logs..."
            className="w-auto"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
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
    </div>
  );
}
