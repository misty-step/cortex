import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import type { LogEntry } from "../../shared/types";

export function Errors() {
  const [source, setSource] = useState("");
  const url = source ? `/api/errors?source=${source}` : "/api/errors";
  const { data: raw, loading, error } = useApi<LogEntry[] | { data: LogEntry[] }>(url);

  const errors: LogEntry[] = raw && !error ? (Array.isArray(raw) ? raw : (raw.data ?? [])) : [];

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
        </div>
      </div>
      <DataTable
        columns={[
          { key: "timestamp", header: "Time" },
          { key: "source", header: "Source" },
          { key: "message", header: "Message" },
        ]}
        data={errors}
      />
    </div>
  );
}
