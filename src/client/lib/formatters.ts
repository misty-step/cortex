// ─── Formatters ─────────────────────────────────────────────────────────────
// Date, bytes, duration, token formatting utilities

export function relativeTime(ms: number): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1_000)}s`;
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

export function usageColor(percent: number): "green" | "yellow" | "red" {
  if (percent >= 80) return "red";
  if (percent >= 50) return "yellow";
  return "green";
}

/** Filter an array of objects by a text query across specified keys. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function filterByText<T extends Record<string, any>>(
  data: T[],
  query: string,
  keys: (keyof T & string)[],
): T[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return data;
  return data.filter((row) =>
    keys.some((key) => {
      const value = row[key];
      if (value == null) return false;
      return String(value).toLowerCase().includes(trimmed);
    }),
  );
}
