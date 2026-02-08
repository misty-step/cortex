// ─── StatusBadge ────────────────────────────────────────────────────────────
// Health status indicator badges
// Implemented in PR 4

interface StatusBadgeProps {
  status: "ok" | "warn" | "error" | "idle";
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = {
    ok: "bg-green-500/15 text-green-400",
    warn: "bg-yellow-500/15 text-yellow-400",
    error: "bg-red-500/15 text-red-400",
    idle: "bg-blue-500/10 text-blue-400",
  };

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${colors[status]}`}>
      {label}
    </span>
  );
}
