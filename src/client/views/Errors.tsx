import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import type { LogEntry } from "../../shared/types";

export function Errors() {
  const [searchQuery, setSearchQuery] = useState("");
  const params = new URLSearchParams();
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  const qs = params.toString();
  const url = qs ? `/api/errors?${qs}` : "/api/errors";
  const { data: raw, loading, error } = useApi<LogEntry[] | { data: LogEntry[] }>(url);

  const errors = useMemo<LogEntry[]>(() => {
    if (!raw || error) return [];
    return Array.isArray(raw) ? raw : (raw.data ?? []);
  }, [raw, error]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load errors</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Recent Errors</h2>
        <div className="flex items-center gap-2">
          {errors.length > 0 && <ExportButton data={errors} filename="errors" />}
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
          { key: "level", header: "Level", sortable: true },
          { key: "message", header: "Message", sortable: false },
        ]}
        data={errors}
      />
    </div>
  );
}
