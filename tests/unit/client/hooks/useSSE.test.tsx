import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useSSE } from "@/client/hooks/useSSE";
import { SSEContext, type SSEContextValue } from "@/client/components/SSEContext";

describe("useSSE", () => {
  const createWrapper = (value?: SSEContextValue) => {
    return function Wrapper({ children }: { children: ReactNode }) {
      const contextValue = value ?? { connected: false, events: [] };
      return <SSEContext.Provider value={contextValue}>{children}</SSEContext.Provider>;
    };
  };

  it("returns default context value when no provider", () => {
    const { result } = renderHook(() => useSSE());

    expect(result.current.connected).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  it("returns context value from provider", () => {
    const mockValue: SSEContextValue = {
      connected: true,
      events: [{ type: "test", data: {} }],
    };

    const { result } = renderHook(() => useSSE(), {
      wrapper: createWrapper(mockValue),
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.events).toEqual([{ type: "test", data: {} }]);
  });

  it("updates when context value changes", () => {
    // Test that the hook reads from context correctly with different values
    const { result: result1 } = renderHook(() => useSSE(), {
      wrapper: createWrapper({ connected: false, events: [] }),
    });
    expect(result1.current.connected).toBe(false);

    const { result: result2 } = renderHook(() => useSSE(), {
      wrapper: createWrapper({ connected: true, events: [{ type: "connected" }] }),
    });
    expect(result2.current.connected).toBe(true);
    expect(result2.current.events).toHaveLength(1);
  });

  it("handles events array of different types", () => {
    const complexEvents = [
      { type: "log_entry", data: { message: "test" } },
      { type: "health", data: { status: "ok" } },
      { type: "error", data: { message: "error" } },
    ];

    const { result } = renderHook(() => useSSE(), {
      wrapper: createWrapper({ connected: true, events: complexEvents }),
    });

    expect(result.current.events).toHaveLength(3);
    expect(result.current.events).toEqual(complexEvents);
  });

  it("handles empty events array", () => {
    const { result } = renderHook(() => useSSE(), {
      wrapper: createWrapper({ connected: true, events: [] }),
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.events).toEqual([]);
  });

  it("handles undefined events", () => {
    const { result } = renderHook(() => useSSE(), {
      wrapper: createWrapper({ connected: true }),
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.events).toBeUndefined();
  });
});
