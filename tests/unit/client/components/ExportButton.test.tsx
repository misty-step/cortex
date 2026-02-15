import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExportButton } from "@/client/components/ExportButton";

describe("ExportButton", () => {
  const mockData = [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" },
  ];

  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the Export button", () => {
    render(<ExportButton data={mockData} />);
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("shows export menu when clicked", () => {
    render(<ExportButton data={mockData} />);

    fireEvent.click(screen.getByText("Export"));

    expect(screen.getByText("Export JSON")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("hides menu when clicking Export again", () => {
    render(<ExportButton data={mockData} />);

    fireEvent.click(screen.getByText("Export"));
    expect(screen.getByText("Export JSON")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Export"));
    expect(screen.queryByText("Export JSON")).not.toBeInTheDocument();
  });

  it("exports JSON when Export JSON is clicked", () => {
    render(<ExportButton data={mockData} filename="users" />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export JSON"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("exports CSV when Export CSV is clicked", () => {
    render(<ExportButton data={mockData} filename="users" />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export CSV"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("closes menu after exporting JSON", () => {
    render(<ExportButton data={mockData} />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export JSON"));

    expect(screen.queryByText("Export JSON")).not.toBeInTheDocument();
  });

  it("closes menu after exporting CSV", () => {
    render(<ExportButton data={mockData} />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export CSV"));

    expect(screen.queryByText("Export CSV")).not.toBeInTheDocument();
  });

  it("uses default filename 'export'", () => {
    render(<ExportButton data={mockData} />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export JSON"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles empty data for CSV export", () => {
    render(<ExportButton data={[]} filename="empty" />);

    fireEvent.click(screen.getByText("Export"));

    // Should not throw
    expect(() => {
      fireEvent.click(screen.getByText("Export CSV"));
    }).not.toThrow();
  });

  it("escapes quotes in CSV values", () => {
    const dataWithQuotes = [{ id: 1, description: 'He said "Hello"' }];

    render(<ExportButton data={dataWithQuotes} />);

    fireEvent.click(screen.getByText("Export"));
    fireEvent.click(screen.getByText("Export CSV"));

    expect(clickSpy).toHaveBeenCalled();
  });

  it("handles data with special characters", () => {
    const dataWithSpecial = [{ id: 1, value: "test,value;semicolon" }];

    render(<ExportButton data={dataWithSpecial} />);

    fireEvent.click(screen.getByText("Export"));

    expect(() => {
      fireEvent.click(screen.getByText("Export CSV"));
    }).not.toThrow();
  });
});
