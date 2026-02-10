import { useEffect, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { DataTable } from "../components/DataTable";

export function Overview() {
  const [health, setHealth] = useState<any>(null);
  const [sprites, setSprites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/health").then(r => r.json()),
      fetch("/api/sprites").then(r => r.json()),
    ]).then(([h, s]) => {
      setHealth(h);
      setSprites(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  const runningSprites = sprites.filter(s => s.status === "running").length;
  const idleSprites = sprites.filter(s => s.status === "idle").length;

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
            { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
            { key: "agent_count", header: "Agents" },
            { key: "last_seen", header: "Last Seen" },
          ]}
          data={sprites}
        />
      </div>
    </div>
  );
}
