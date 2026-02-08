// ─── Event Bus ──────────────────────────────────────────────────────────────
// SSE event distribution to connected clients
// Implemented in PR 2

import type { SSEEvent } from "../../shared/types.js";

type EventHandler = (event: SSEEvent) => void;

const listeners = new Set<EventHandler>();

export function subscribe(handler: EventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function broadcast(event: SSEEvent): void {
  for (const handler of listeners) {
    handler(event);
  }
}
