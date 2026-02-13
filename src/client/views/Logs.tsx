import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import type { LogEntry } from "../../shared/types";

export function Logs() {
  const [level, setLevel] = useState("");
  const url = level ? `/api/logs?level=${level}` : "/api/logs";
  const { data: raw, loading } = useApi<LogEntry[] | { data: LogEntry[] }>(url);

  const logs: LogEntry[] = raw ? (Array.isArray(raw) ? raw : (raw.data ?? [])) : [];

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gateway Logs</h2>
        <div className="flex items-center gap-2">
          {logs.length > 0 && <ExportButton data={logs} filename="logs" />}
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="bg-[var(--bg2)] border rounded px-2 py-1"
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
          { key: "timestamp", header: "Time" },
          { key: "level", header: "Level" },
          { key: "message", header: "Message" },
        ]}
        data={logs}
      />
    </div>
  );
}
