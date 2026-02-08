// ─── API Client ─────────────────────────────────────────────────────────────
// Typed API client for Cortex server
// Implemented in PR 4

const BASE_URL = "/api";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}
