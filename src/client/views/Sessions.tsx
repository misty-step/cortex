import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { relativeTime } from "../lib/formatters";

export function Sessions() {
  const { data, loading, error } = useApi<Record<string, unknown>[]>("/api/sessions");
  const sessions = data ?? [];

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load sessions</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Agent Sessions</h2>
        {sessions.length > 0 && <ExportButton data={sessions} filename="sessions" />}
      </div>
      <DataTable
        columns={[
          { key: "agent_id", header: "Agent" },
          {
            key: "session_key",
            header: "Session",
            render: (v: string) => (
              <span className="font-mono text-xs" title={v}>
                {v.split(":").slice(-2).join(":")}
              </span>
            ),
          },
          { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
          {
            key: "model",
            header: "Model",
            render: (v: string) => (v ? v.split("/").pop() : "\u2014"),
          },
          {
            key: "last_activity",
            header: "Last Activity",
            render: (v: string | null) => (v ? relativeTime(new Date(v).getTime()) : "\u2014"),
          },
        ]}
        data={sessions}
      />
    </div>
  );
}
