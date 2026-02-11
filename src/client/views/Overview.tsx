import { useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { DataTable } from "../components/DataTable";

type HealthStatus = {
  status: string;
  gateway: string;
  timestamp: number;
};

type SpriteRow = {
  name: string;
  status: string;
  agent_count: number;
  last_seen: string | null;
};

export function Overview() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [sprites, setSprites] = useState<SpriteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then((r) => r.json()),
      fetch("/api/sprites").then((r) => r.json()),
    ]).then(([h, s]: [unknown, unknown]) => {
      setHealth(h as HealthStatus);
      setSprites(Array.isArray(s) ? (s as SpriteRow[]) : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  const runningSprites = sprites.filter((s) => s.status === "running").length;
  const idleSprites = sprites.filter((s) => s.status === "idle").length;

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-[var(--fg)]">Factory Overview</h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--bg2)] p-4 rounded-lg">
          <div className="text-sm text-[var(--fg3)]">Gateway</div>
          <div className="text-2xl font-semibold">
            <StatusBadge status={health?.status || "unknown"} />
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
            {
              key: "status",
              header: "Status",
              render: (v) => <StatusBadge status={typeof v === "string" ? v : String(v ?? "")} />,
            },
            { key: "agent_count", header: "Agents" },
            { key: "last_seen", header: "Last Seen" },
          ]}
          data={sprites}
        />
      </div>
    </div>
  );
}
