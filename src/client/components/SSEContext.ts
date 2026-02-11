import { createContext } from "react";

export interface SSEContextValue {
  connected: boolean;
  events?: unknown[];
}

export const SSEContext = createContext<SSEContextValue>({ connected: false, events: [] });
