// ─── SSE Provider ───────────────────────────────────────────────────────────
// Context provider for SSE connection — implemented in PR 4

import type { ReactNode } from "react";
import { SSEContext } from "./SSEContext";

export function SSEProvider({ children }: { children: ReactNode }) {
  // SSE connection logic implemented in PR 4
  return <SSEContext.Provider value={{ connected: false }}>{children}</SSEContext.Provider>;
}
