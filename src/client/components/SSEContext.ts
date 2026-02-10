import { createContext } from "react";

export interface SSEContextValue {
  connected: boolean;
  events?: any[];
}

export const SSEContext = createContext<SSEContextValue>({ connected: false, events: [] });
