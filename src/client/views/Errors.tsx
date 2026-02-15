import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import type { LogEntry, PaginatedResponse } from "../../shared/types";

export function Errors() {
  const [searchQuery, setSearchQuery] = useState("");
  const [source, setSource] = useState("");
  const params = new URLSearchParams();
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  if (source) params.set("source", source);
  const qs = params.toString();
  const url = qs ? `/api/errors?${qs}` : "/api/errors";
  const { data, loading, error } = useApi<PaginatedResponse<LogEntry>>(url);

  const errors = useMemo<LogEntry[]>(() => {
    if (!data || error) return [];
    return data.data;
  }, [data, error]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load errors</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Recent Errors</h2>
        <div className="flex items-center gap-2">
          {errors.length > 0 && <ExportButton data={errors} filename="errors" />}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="bg-[var(--bg2)] border rounded px-2 py-1"
          >
            <option value="">All Sources</option>
            <option value="gateway-err">Gateway</option>
            <option value="json-log">Agents</option>
          </select>
          <SearchBar
            onDebouncedSearch={setSearchQuery}
            placeholder="Search errors..."
            className="w-auto"
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "timestamp", header: "Time", sortable: true },
          { key: "source", header: "Source", sortable: true },
          { key: "level", header: "Level", sortable: true },
          { key: "message", header: "Message", sortable: false },
        ]}
        data={errors}
      />
    </div>
  );
}
