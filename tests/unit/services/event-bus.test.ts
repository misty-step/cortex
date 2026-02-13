import { describe, it, expect, vi } from "vitest";
import { subscribe, broadcast } from "../../../src/server/services/event-bus";
import type { SSEEvent } from "../../../src/shared/types";

describe("event-bus", () => {
  it("should deliver broadcast events to a subscriber", () => {
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);

    const event: SSEEvent = { type: "connected", data: { test: true } };
    broadcast(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
    unsubscribe();
  });

  it("should stop delivering events after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);
    unsubscribe();

    broadcast({ type: "connected", data: {} });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should deliver events to multiple subscribers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = subscribe(handler1);
    const unsub2 = subscribe(handler2);

    const event: SSEEvent = { type: "health", data: { ok: true } };
    broadcast(event);

    expect(handler1).toHaveBeenCalledWith(event);
    expect(handler2).toHaveBeenCalledWith(event);
    unsub1();
    unsub2();
  });

  it("should only unsubscribe the specific handler", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = subscribe(handler1);
    const unsub2 = subscribe(handler2);

    unsub1();
    broadcast({ type: "sessions", data: [] });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
    unsub2();
  });

  it("should handle broadcast with no subscribers without errors", () => {
    expect(() => {
      broadcast({ type: "error", data: { msg: "test" } });
    }).not.toThrow();
  });

  it("should deliver different event types correctly", () => {
    const handler = vi.fn();
    const unsub = subscribe(handler);

    broadcast({ type: "log_entry", data: { message: "test log" } });
    broadcast({ type: "tool_call", data: { tool: "grep" } });
    broadcast({ type: "crons", data: [] });

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler.mock.calls[0]![0]).toEqual({ type: "log_entry", data: { message: "test log" } });
    expect(handler.mock.calls[1]![0]).toEqual({ type: "tool_call", data: { tool: "grep" } });
    expect(handler.mock.calls[2]![0]).toEqual({ type: "crons", data: [] });
    unsub();
  });

  it("should allow resubscribing after unsubscribe", () => {
    const handler = vi.fn();
    const unsub1 = subscribe(handler);
    unsub1();

    broadcast({ type: "connected", data: {} });
    expect(handler).not.toHaveBeenCalled();

    const unsub2 = subscribe(handler);
    broadcast({ type: "connected", data: {} });
    expect(handler).toHaveBeenCalledOnce();
    unsub2();
  });

  it("should be safe to call unsubscribe multiple times", () => {
    const handler = vi.fn();
    const unsub = subscribe(handler);

    unsub();
    unsub(); // should not throw
    unsub();

    broadcast({ type: "connected", data: {} });
    expect(handler).not.toHaveBeenCalled();
  });
});
