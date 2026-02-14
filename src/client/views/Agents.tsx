import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import { relativeTime } from "../lib/formatters";
import type { AgentStatus } from "../../shared/types";

function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        online ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
      }`}
    >
      <span className={`w-2 h-2 rounded-full mr-1 ${online ? "bg-green-500" : "bg-gray-400"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="text-xs text-green-400">Enabled</span>
  ) : (
    <span className="text-xs text-red-400">Disabled</span>
  );
}

function formatHeartbeat(isoString: string | null): string {
  if (!isoString) return "—";
  const ms = new Date(isoString).getTime();
  if (isNaN(ms)) return "—";
  return relativeTime(ms);
}

export function Agents() {
  const { data, loading, error } = useApi<AgentStatus[]>("/api/agents");
  const agents = data ?? [];

  if (loading) return <div className="p-4">Loading agents...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load agents: {error}</div>;

  const onlineCount = agents.filter((a) => a.online).length;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">Agent Status</h2>
          <p className="text-sm text-gray-500">
            {onlineCount} of {agents.length} agents online
          </p>
        </div>
        {agents.length > 0 && <ExportButton data={agents} filename="agents" />}
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Agent Name" },
          { key: "id", header: "Agent ID" },
          {
            key: "online",
            header: "Status",
            render: (v: boolean) => <OnlineBadge online={v} />,
          },
          {
            key: "sessionCount",
            header: "Sessions",
            render: (v: number) => v.toString(),
          },
          {
            key: "lastHeartbeat",
            header: "Last Heartbeat",
            render: (v: string | null) => formatHeartbeat(v),
          },
          { key: "currentModel", header: "Model" },
          {
            key: "enabled",
            header: "Config",
            render: (v: boolean) => <EnabledBadge enabled={v} />,
          },
        ]}
        data={agents}
      />
    </div>
  );
}
