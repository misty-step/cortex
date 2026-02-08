// ─── useSSE Hook ────────────────────────────────────────────────────────────
// SSE subscription hook for real-time updates
// Implemented in PR 4

import { useContext } from "react";
import { SSEContext } from "../components/SSEContext";

export function useSSE() {
  return useContext(SSEContext);
}
