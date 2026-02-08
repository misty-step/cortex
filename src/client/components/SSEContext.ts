import { createContext } from "react";

export interface SSEContextValue {
  connected: boolean;
}

export const SSEContext = createContext<SSEContextValue>({ connected: false });
