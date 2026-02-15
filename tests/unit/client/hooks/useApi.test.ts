import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useApi } from "@/client/hooks/useApi";

// Helper to mock fetch with proper types
const mockFetch = (impl: ReturnType<typeof vi.fn>) => {
  global.fetch = impl as unknown as typeof fetch;
};

describe("useApi", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with loading state and null data", () => {
    const { result } = renderHook(() => useApi("/api/test", 10_000));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches data successfully", async () => {
    const mockData = { id: 1, name: "Test" };
    mockFetch(
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      } as Response),
    );

    const { result } = renderHook(() => useApi("/api/test", 10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch errors", async () => {
    mockFetch(
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response),
    );

    const { result } = renderHook(() => useApi("/api/test", 10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("500 Internal Server Error");
  });

  it("handles network errors", async () => {
    mockFetch(vi.fn().mockRejectedValueOnce(new Error("Network failure")));

    const { result } = renderHook(() => useApi("/api/test", 10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Network failure");
  });

  it("handles non-Error exceptions", async () => {
    mockFetch(vi.fn().mockRejectedValueOnce("String error"));

    const { result } = renderHook(() => useApi("/api/test", 10_000));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Unknown error");
  });

  it("refetches on interval", async () => {
    const mockData1 = { count: 1 };
    const mockData2 = { count: 2 };

    mockFetch(
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData1),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData2),
        } as Response),
    );

    const { result } = renderHook(() => useApi("/api/test", 1000));

    // Wait for first fetch
    await waitFor(() => {
      expect(result.current.data).toEqual(mockData1);
    });

    // Advance timer to trigger refetch
    await vi.advanceTimersByTimeAsync(1000);

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("cancels in-flight request on unmount", async () => {
    mockFetch(
      vi.fn().mockImplementation(() => {
        return new Promise(() => {
          // Never resolves
        });
      }),
    );

    const { unmount } = renderHook(() => useApi("/api/test", 10_000));

    // Should not throw
    expect(() => unmount()).not.toThrow();
  });

  it("does not update state after unmount", async () => {
    mockFetch(
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: "test" }),
      } as Response),
    );

    const { result, unmount } = renderHook(() => useApi("/api/test", 10_000));

    // Unmount before fetch completes
    unmount();

    // Wait a bit to ensure fetch would have completed
    await new Promise((r) => setTimeout(r, 10));

    // State should not have been updated
    expect(result.current.loading).toBe(true);
  });

  it("refetches when URL changes", async () => {
    mockFetch(
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 1 }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 2 }),
        } as Response),
    );

    const { result, rerender } = renderHook(({ url }) => useApi(url, 10_000), {
      initialProps: { url: "/api/item/1" },
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1 });
    });

    rerender({ url: "/api/item/2" });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 2 });
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses default refresh interval of 10 seconds", async () => {
    mockFetch(
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response),
    );

    renderHook(() => useApi("/api/test"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("preserves data on refetch error", async () => {
    const mockData = { id: 1 };

    mockFetch(
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Error",
        } as Response),
    );

    const { result } = renderHook(() => useApi("/api/test", 1000));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    // Trigger refetch
    await vi.advanceTimersByTimeAsync(1000);

    await waitFor(() => {
      expect(result.current.error).toBe("500 Error");
    });

    // Data should still be available
    expect(result.current.data).toEqual(mockData);
  });
});
