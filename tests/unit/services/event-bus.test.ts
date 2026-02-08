import { describe, it, expect, vi } from "vitest";
import { subscribe, broadcast } from "../../../src/server/services/event-bus";

describe("event-bus", () => {
  it("broadcasts events to subscribers", () => {
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);

    broadcast({ type: "connected", data: { test: true } });

    expect(handler).toHaveBeenCalledWith({ type: "connected", data: { test: true } });
    unsubscribe();
  });

  it("stops receiving events after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = subscribe(handler);
    unsubscribe();

    broadcast({ type: "connected", data: {} });

    expect(handler).not.toHaveBeenCalled();
  });
});
