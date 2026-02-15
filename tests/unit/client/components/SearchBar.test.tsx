import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SearchBar } from "@/client/components/SearchBar";

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with default placeholder", () => {
    render(<SearchBar />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(<SearchBar placeholder="Find users..." />);
    expect(screen.getByPlaceholderText("Find users...")).toBeInTheDocument();
  });

  it("triggers onSearch when form is submitted", () => {
    const onSearch = vi.fn();
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.submit(input.closest("form")!);

    expect(onSearch).toHaveBeenCalledWith("test query");
  });

  it("triggers onDebouncedSearch after delay", async () => {
    const onDebouncedSearch = vi.fn();
    render(<SearchBar onDebouncedSearch={onDebouncedSearch} debounceMs={300} />);

    // Clear initial empty string call
    await vi.advanceTimersByTimeAsync(400);
    onDebouncedSearch.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "debounced" } });

    // Should not trigger immediately
    expect(onDebouncedSearch).not.toHaveBeenCalled();

    // Advance past debounce delay
    await vi.advanceTimersByTimeAsync(350);

    await waitFor(() => {
      expect(onDebouncedSearch).toHaveBeenCalledWith("debounced");
    });
  });

  it("shows clear button when there is text", () => {
    render(<SearchBar />);

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "something" } });

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("hides clear button when input is empty", () => {
    render(<SearchBar />);
    expect(screen.queryByLabelText("Clear search")).not.toBeInTheDocument();
  });

  it("clears input and triggers callbacks when clear is clicked", () => {
    const onSearch = vi.fn();
    const onDebouncedSearch = vi.fn();

    render(<SearchBar onSearch={onSearch} onDebouncedSearch={onDebouncedSearch} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "to clear" } });

    fireEvent.click(screen.getByLabelText("Clear search"));

    expect(input.value).toBe("");
    expect(onSearch).toHaveBeenCalledWith("");
    expect(onDebouncedSearch).toHaveBeenCalledWith("");
  });

  it("syncs with controlled value prop", () => {
    const { rerender } = render(<SearchBar value="initial" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("initial");

    rerender(<SearchBar value="updated" />);
    expect(input.value).toBe("updated");
  });

  it("updates internal state when user types", () => {
    render(<SearchBar />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "typing" } });

    expect(input.value).toBe("typing");
  });

  it("applies custom className", () => {
    const { container } = render(<SearchBar className="custom-class" />);
    expect(container.querySelector(".custom-class")).toBeInTheDocument();
  });

  it("uses custom debounce delay", async () => {
    const onDebouncedSearch = vi.fn();
    render(<SearchBar onDebouncedSearch={onDebouncedSearch} debounceMs={500} />);

    // Clear initial empty string call
    await vi.advanceTimersByTimeAsync(600);
    onDebouncedSearch.mockClear();

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "slow" } });

    // Should not trigger at 300ms
    vi.advanceTimersByTime(300);
    expect(onDebouncedSearch).not.toHaveBeenCalled();

    // Should trigger at 500ms
    await vi.advanceTimersByTimeAsync(250);

    await waitFor(() => {
      expect(onDebouncedSearch).toHaveBeenCalledWith("slow");
    });
  });

  it("resets debounce timer on rapid typing", async () => {
    const onDebouncedSearch = vi.fn();
    render(<SearchBar onDebouncedSearch={onDebouncedSearch} debounceMs={300} />);

    // Clear initial empty string call
    await vi.advanceTimersByTimeAsync(400);
    onDebouncedSearch.mockClear();

    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "a" } });
    vi.advanceTimersByTime(200);

    fireEvent.change(input, { target: { value: "ab" } });
    vi.advanceTimersByTime(200);

    fireEvent.change(input, { target: { value: "abc" } });
    vi.advanceTimersByTime(200);

    // Should not have triggered yet
    expect(onDebouncedSearch).not.toHaveBeenCalled();

    // Complete the debounce
    await vi.advanceTimersByTimeAsync(150);

    await waitFor(() => {
      expect(onDebouncedSearch).toHaveBeenCalledTimes(1);
      expect(onDebouncedSearch).toHaveBeenCalledWith("abc");
    });
  });

  it("handles uncontrolled component without value prop", () => {
    render(<SearchBar />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "uncontrolled" } });

    expect(input.value).toBe("uncontrolled");
  });

  it("does not override internal state when value is undefined", () => {
    render(<SearchBar value={undefined} />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "typed" } });

    expect(input.value).toBe("typed");
  });
});
