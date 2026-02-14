import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { relativeTime, formatDuration } from "../lib/formatters";
import type { SpriteStatus } from "../../shared/types";

export function Sprites() {
  const { data, loading, error } = useApi<SpriteStatus[]>("/api/sprites");
  const sprites = data ?? [];

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load sprites</div>;

  const runningCount = sprites.filter((s) => s.status === "running").length;
  const staleCount = sprites.filter((s) => s.status === "stale" || s.status === "dead").length;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold">Sprite Fleet</h2>
          <p className="text-sm text-gray-600 mt-1">
            {runningCount} running, {sprites.length - runningCount} idle
            {staleCount > 0 && (
              <span className="text-amber-600 ml-2">({staleCount} need attention)</span>
            )}
          </p>
        </div>
        {sprites.length > 0 && <ExportButton data={sprites} filename="sprites" />}
      </div>

      <DataTable
        columns={[
          { key: "name", header: "Sprite" },
          {
            key: "status",
            header: "Status",
            render: (v: string) => <StatusBadge status={v} />,
          },
          {
            key: "assigned_task",
            header: "Current Task",
            render: (v: string | null) => (
              <span className="text-sm text-gray-700 max-w-xs truncate block" title={v ?? undefined}>
                {v ?? "—"}
              </span>
            ),
          },
          {
            key: "runtime_seconds",
            header: "Runtime",
            render: (v: number | null) => (v ? formatDuration(v * 1000) : "—"),
          },
          {
            key: "agent_count",
            header: "Agents",
            render: (v: number) => (
              <span className={v > 0 ? "font-medium text-green-700" : "text-gray-500"}>{v}</span>
            ),
          },
          {
            key: "last_seen",
            header: "Last Activity",
            render: (v: string | null) => (v ? relativeTime(new Date(v).getTime()) : "—"),
          },
        ]}
        data={sprites}
      />
    </div>
  );
}
