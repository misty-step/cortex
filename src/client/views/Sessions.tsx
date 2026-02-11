import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import type { AgentSessionSummary } from "@shared/types";

export function Sessions() {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data: unknown) => {
        setSessions(Array.isArray(data) ? (data as AgentSessionSummary[]) : []);
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
      <h2 className="text-2xl font-bold mb-4">Agent Sessions</h2>
      <DataTable
        columns={[
          { key: "agent_id", header: "Agent" },
          {
            key: "session_key",
            header: "Session",
            render: (v) => {
              const sessionKey = typeof v === "string" ? v : String(v ?? "");
              return (
                <span className="font-mono text-xs" title={sessionKey}>
                  {sessionKey.split(":").slice(-2).join(":")}
                </span>
              );
            },
          },
          {
            key: "status",
            header: "Status",
            render: (v) => <StatusBadge status={typeof v === "string" ? v : String(v ?? "")} />,
          },
          {
            key: "model",
            header: "Model",
            render: (v) => {
              const model = typeof v === "string" ? v : "";
              return model ? model.split("/").pop() : "—";
            },
          },
          {
            key: "last_activity",
            header: "Last Activity",
            render: (v) => formatRelative(typeof v === "string" ? v : null),
          },
        ]}
        data={sessions}
      />
    </div>
  );
}
