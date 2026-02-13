import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";

export function Overview() {
  const { data: health, loading: healthLoading } = useApi<Record<string, unknown>>("/api/health");
  const { data: sprites, loading: spritesLoading } =
    useApi<Record<string, unknown>[]>("/api/sprites");

  if (healthLoading || spritesLoading) return <div className="p-4">Loading...</div>;

  const spriteList = sprites ?? [];
  const runningSprites = spriteList.filter((s) => s.status === "running").length;
  const idleSprites = spriteList.filter((s) => s.status === "idle").length;

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-[var(--fg)]">Factory Overview</h2>
        {spriteList.length > 0 && <ExportButton data={spriteList} filename="sprites" />}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Gateway</div>
          <div className="text-2xl font-semibold">
            <StatusBadge status={String(health?.status ?? "unknown")} />
          </div>
        </div>
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Running Sprites</div>
          <div className="text-2xl font-semibold text-green-500">{runningSprites}</div>
        </div>
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Idle Sprites</div>
          <div className="text-2xl font-semibold text-yellow-500">{idleSprites}</div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Fleet Status</h3>
        <DataTable
          columns={[
            { key: "name", header: "Sprite" },
            { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
            { key: "agent_count", header: "Agents" },
            { key: "last_seen", header: "Last Seen" },
          ]}
          data={spriteList}
        />
      </div>
    </div>
  );
}
