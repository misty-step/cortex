import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebounce } from "@/client/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("debounces value changes", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    expect(result.current).toBe("initial");

    // Change the value
    rerender({ value: "changed" });

    // Value should not change immediately
    expect(result.current).toBe("initial");

    // Advance time but not enough
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    // Advance past the delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    await waitFor(() => {
      expect(result.current).toBe("changed");
    });
  });

  it("resets timer on rapid changes", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    // First change
    rerender({ value: "change1" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    // Second change before timer completes - should reset
    rerender({ value: "change2" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("initial");

    // Now let it complete
    act(() => {
      vi.advanceTimersByTime(150);
    });

    await waitFor(() => {
      expect(result.current).toBe("change2");
    });
  });

  it("uses default delay of 300ms", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: "initial" },
    });

    rerender({ value: "changed" });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("initial");

    act(() => {
      vi.advanceTimersByTime(10);
    });

    await waitFor(() => {
      expect(result.current).toBe("changed");
    });
  });

  it("cleans up timer on unmount", () => {
    const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

    const { unmount, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "initial" },
    });

    // Trigger a debounce
    rerender({ value: "changed" });

    // Unmount should clean up
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("handles numeric values", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 0 },
    });

    rerender({ value: 42 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current).toBe(42);
    });
  });

  it("handles object values", async () => {
    const initialObj = { count: 0 };
    const newObj = { count: 5 };

    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: initialObj },
    });

    rerender({ value: newObj });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current).toEqual({ count: 5 });
    });
  });

  it("handles array values", async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: [1, 2] },
    });

    rerender({ value: [1, 2, 3] });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    await waitFor(() => {
      expect(result.current).toEqual([1, 2, 3]);
    });
  });
});
