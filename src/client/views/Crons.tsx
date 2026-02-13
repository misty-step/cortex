import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";

export function Crons() {
  const [crons, setCrons] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crons")
      .then((r) => r.json())
      .then((data) => {
        setCrons(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  // Format relative time
  const formatRelative = (iso: string | null) => {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Cron Jobs ({crons.length})</h2>
      <DataTable
        columns={[
          {
            key: "name",
            header: "Name",
            render: (v, row) => (
              <div>
                <div className="font-medium">{String(v)}</div>
                <div className="text-xs text-[var(--fg3)] font-mono">
                  {String(row.id ?? "").slice(0, 8)}
                </div>
              </div>
            ),
          },
          { key: "agent_id", header: "Agent" },
          {
            key: "schedule",
            header: "Schedule",
            render: (v: string) => (
              <code className="text-xs bg-[var(--bg2)] px-1 rounded">{v}</code>
            ),
          },
          { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
          {
            key: "last_status",
            header: "Last Run",
            render: (v, row) => (
              <div>
                <StatusBadge status={v === "ok" ? "ok" : v === "error" ? "error" : "warn"} />
                <div className="text-xs text-[var(--fg3)] mt-1">
                  {formatRelative(row.last_run as string | null)}
                </div>
              </div>
            ),
          },
        ]}
        data={crons}
      />
    </div>
  );
}
