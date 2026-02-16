import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Pagination } from "@/client/components/Pagination";

describe("Pagination", () => {
  it("renders nothing when all items fit on one page", () => {
    const { container } = render(
      <Pagination page={1} total={50} limit={100} hasMore={false} onPageChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders when total exceeds limit", () => {
    render(<Pagination page={1} total={150} limit={100} hasMore={true} onPageChange={vi.fn()} />);
    expect(screen.getByText(/150 total/)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 2/)).toBeInTheDocument();
  });

  it("disables Prev on first page", () => {
    render(<Pagination page={1} total={200} limit={100} hasMore={true} onPageChange={vi.fn()} />);
    expect(screen.getByText("Prev")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("disables Next when hasMore is false", () => {
    render(<Pagination page={2} total={200} limit={100} hasMore={false} onPageChange={vi.fn()} />);
    expect(screen.getByText("Prev")).not.toBeDisabled();
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("calls onPageChange with next page", () => {
    const onChange = vi.fn();
    render(<Pagination page={1} total={200} limit={100} hasMore={true} onPageChange={onChange} />);
    fireEvent.click(screen.getByText("Next"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with previous page", () => {
    const onChange = vi.fn();
    render(<Pagination page={2} total={200} limit={100} hasMore={true} onPageChange={onChange} />);
    fireEvent.click(screen.getByText("Prev"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("shows correct total pages", () => {
    render(<Pagination page={1} total={350} limit={100} hasMore={true} onPageChange={vi.fn()} />);
    expect(screen.getByText(/page 1 of 4/)).toBeInTheDocument();
  });
});
