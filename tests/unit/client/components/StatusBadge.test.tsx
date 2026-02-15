import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/client/components/StatusBadge";

describe("StatusBadge", () => {
  it("renders the status text", () => {
    render(<StatusBadge status="ok" />);
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  describe("green statuses", () => {
    const greenStatuses = ["ok", "reachable", "running", "active", "available"];

    greenStatuses.forEach((status) => {
      it(`renders ${status} with green styling`, () => {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.querySelector("span");
        expect(badge).toHaveClass("bg-green-500/15", "text-green-400");
      });
    });
  });

  describe("yellow statuses", () => {
    const yellowStatuses = ["warn", "warning"];

    yellowStatuses.forEach((status) => {
      it(`renders ${status} with yellow styling`, () => {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.querySelector("span");
        expect(badge).toHaveClass("bg-yellow-500/15", "text-yellow-400");
      });
    });
  });

  describe("red statuses", () => {
    const redStatuses = ["error", "unreachable", "degraded"];

    redStatuses.forEach((status) => {
      it(`renders ${status} with red styling`, () => {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.querySelector("span");
        expect(badge).toHaveClass("bg-red-500/15", "text-red-400");
      });
    });
  });

  describe("gray statuses", () => {
    const grayStatuses = ["unknown", "disabled"];

    grayStatuses.forEach((status) => {
      it(`renders ${status} with gray styling`, () => {
        const { container } = render(<StatusBadge status={status} />);
        const badge = container.querySelector("span");
        expect(badge).toHaveClass("bg-gray-500/10", "text-gray-400");
      });
    });
  });

  describe("blue status", () => {
    it("renders idle with blue styling", () => {
      const { container } = render(<StatusBadge status="idle" />);
      const badge = container.querySelector("span");
      expect(badge).toHaveClass("bg-blue-500/10", "text-blue-400");
    });
  });

  it("handles uppercase status text", () => {
    const { container } = render(<StatusBadge status="OK" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-green-500/15", "text-green-400");
  });

  it("handles mixed case status text", () => {
    const { container } = render(<StatusBadge status="Running" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-green-500/15", "text-green-400");
  });

  it("defaults to gray for unknown status", () => {
    const { container } = render(<StatusBadge status="custom-status" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-gray-500/10", "text-gray-400");
  });

  it("handles empty string status", () => {
    const { container } = render(<StatusBadge status="" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-gray-500/10", "text-gray-400");
  });

  it("handles null status", () => {
    const { container } = render(<StatusBadge status={null as unknown as string} />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass("bg-gray-500/10", "text-gray-400");
  });

  it("applies correct base styling", () => {
    const { container } = render(<StatusBadge status="ok" />);
    const badge = container.querySelector("span");
    expect(badge).toHaveClass(
      "inline-block",
      "px-2",
      "py-0.5",
      "rounded",
      "text-xs",
      "font-medium",
    );
  });
});
