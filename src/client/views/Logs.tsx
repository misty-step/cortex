import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import type { LogEntry } from "../../shared/types";

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState("");

  useEffect(() => {
    const url = level ? `/api/logs?level=${level}` : "/api/logs";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setLogs(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(() => {
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [level]);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Gateway Logs</h2>
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
