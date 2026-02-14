import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { relativeTime } from "../lib/formatters";

export function Crons() {
  const { data, loading, error } = useApi<Record<string, unknown>[]>("/api/crons");
  const crons = data ?? [];

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load cron jobs</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Cron Jobs ({crons.length})</h2>
        {crons.length > 0 && <ExportButton data={crons} filename="crons" />}
      </div>
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
                  {row.last_run
                    ? relativeTime(new Date(row.last_run as string).getTime())
                    : "\u2014"}
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
        data={crons}
      />
    </div>
  );
}
