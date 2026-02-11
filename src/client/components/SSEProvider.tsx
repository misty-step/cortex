import { useEffect, useState, type ReactNode } from "react";
import { SSEContext } from "./SSEContext";

export function SSEProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<unknown[]>([]);

  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [...prev.slice(-99), data]);
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  return <SSEContext.Provider value={{ connected, events }}>{children}</SSEContext.Provider>;
}
