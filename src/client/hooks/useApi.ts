// ─── useApi Hook ────────────────────────────────────────────────────────────
// Data fetching hook with auto-refresh
// Implemented in PR 4

import { useState, useEffect } from "react";

export function useApi<T>(url: string, refreshMs = 10_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [url, refreshMs]);

  return { data, error, loading };
}
