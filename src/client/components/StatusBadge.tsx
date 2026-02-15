// ─── StatusBadge ────────────────────────────────────────────────────────────
// Health status indicator badges

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || "unknown";

  const colors: Record<string, string> = {
    ok: "bg-green-500/15 text-green-400",
    reachable: "bg-green-500/15 text-green-400",
    running: "bg-green-500/15 text-green-400",
    active: "bg-green-500/15 text-green-400",
    available: "bg-green-500/15 text-green-400",
    complete: "bg-green-500/15 text-green-400",
    warn: "bg-yellow-500/15 text-yellow-400",
    warning: "bg-yellow-500/15 text-yellow-400",
    stale: "bg-yellow-500/15 text-yellow-400",
    error: "bg-red-500/15 text-red-400",
    unreachable: "bg-red-500/15 text-red-400",
    degraded: "bg-red-500/15 text-red-400",
    dead: "bg-red-500/15 text-red-400",
    idle: "bg-blue-500/10 text-blue-400",
    unknown: "bg-gray-500/10 text-gray-400",
    disabled: "bg-gray-500/10 text-gray-400",
  };

  const colorClass = colors[normalized] || colors.unknown;

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {status}
    </span>
  );
}
