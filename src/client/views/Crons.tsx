import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";

type CronRow = {
  id: string;
  name: string;
  agent_id: string;
  schedule: string;
  last_run: string | null;
  next_run: string | null;
  status: string;
  last_status: string;
};

export function Crons() {
  const [crons, setCrons] = useState<CronRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/crons")
      .then((r) => r.json())
      .then((data: unknown) => {
        setCrons(Array.isArray(data) ? (data as CronRow[]) : []);
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
            render: (v, row) => {
              const name = typeof v === "string" ? v : "";
              const id = typeof row["id"] === "string" ? row["id"].slice(0, 8) : "";
              return (
                <div>
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-[var(--fg3)] font-mono">{id}</div>
                </div>
              );
            },
          },
          { key: "agent_id", header: "Agent" },
          {
            key: "schedule",
            header: "Schedule",
            render: (v) => (
              <code className="text-xs bg-[var(--bg2)] px-1 rounded">{String(v ?? "")}</code>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (v) => <StatusBadge status={typeof v === "string" ? v : String(v ?? "")} />,
          },
          {
            key: "last_status",
            header: "Last Run",
            render: (v, row) => {
              const status = typeof v === "string" ? v : "";
              const lastRunIso = typeof row["last_run"] === "string" ? row["last_run"] : null;
              return (
                <div>
                  <StatusBadge
                    status={status === "ok" ? "ok" : status === "error" ? "error" : "warn"}
                  />
                  <div className="text-xs text-[var(--fg3)] mt-1">{formatRelative(lastRunIso)}</div>
                </div>
              );
            },
          },
        ]}
        data={crons}
      />
    </div>
  );
}
