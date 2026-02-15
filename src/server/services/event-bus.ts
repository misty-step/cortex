// ─── Event Bus ──────────────────────────────────────────────────────────────
// SSE event distribution to connected clients
// Implemented in PR 2

import type { SSEEvent } from "../../shared/types.js";

type EventHandler = (event: SSEEvent) => void;

const listeners = new Set<EventHandler>();

// Connection limiting for SSE endpoint
const DEFAULT_MAX_CONNECTIONS = 20;
export const MAX_CONNECTIONS =
  parseInt(process.env.MAX_SSE_CONNECTIONS ?? "", 10) || DEFAULT_MAX_CONNECTIONS;
let activeConnectionCount = 0;

/**
 * Reset the connection count (for testing only).
 * @internal - should only be used in test environment
 */
export function resetConnectionCount(): void {
  activeConnectionCount = 0;
}

export function subscribe(handler: EventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function broadcast(event: SSEEvent): void {
  for (const handler of listeners) {
    handler(event);
  }
}

/**
 * Increment the active SSE connection count.
 * @returns true if connection allowed, false if at limit
 */
export function incrementConnection(): boolean {
  if (activeConnectionCount >= MAX_CONNECTIONS) {
    return false;
  }
  activeConnectionCount++;
  return true;
}

/**
 * Decrement the active SSE connection count.
 */
export function decrementConnection(): void {
  if (activeConnectionCount > 0) {
    activeConnectionCount--;
  }
}

/**
 * Get the current number of active SSE connections.
 */
export function getConnectionCount(): number {
  return activeConnectionCount;
}
