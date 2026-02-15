import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "@/client/components/DataTable";

describe("DataTable", () => {
  const mockColumns = [
    { key: "id", header: "ID" },
    { key: "name", header: "Name" },
    { key: "role", header: "Role" },
  ];

  const mockData = [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" },
    { id: 3, name: "Charlie", role: "admin" },
  ];

  it("renders empty message when no data", () => {
    render(<DataTable columns={mockColumns} data={[]} />);
    expect(screen.getByText("No data available")).toBeInTheDocument();
  });

  it("renders custom empty message", () => {
    render(<DataTable columns={mockColumns} data={[]} emptyMessage="Custom empty" />);
    expect(screen.getByText("Custom empty")).toBeInTheDocument();
  });

  it("renders column headers", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText("ID")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("renders all data rows", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("uses rowKey for React keys when provided", () => {
    render(<DataTable columns={mockColumns} data={mockData} rowKey="id" />);

    // Should render without warnings
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("shows sort indicator on header click", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    // Should show ascending indicator
    expect(nameHeader.textContent).toContain("↑");
  });

  it("toggles sort direction on second click", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);
    expect(nameHeader.textContent).toContain("↑");

    fireEvent.click(nameHeader);
    expect(nameHeader.textContent).toContain("↓");
  });

  it("does not sort when sortable is false", () => {
    render(<DataTable columns={mockColumns} data={mockData} sortable={false} />);

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    // Should not show sort indicator
    expect(nameHeader.textContent).not.toContain("↑");
    expect(nameHeader.textContent).not.toContain("↓");
  });

  it("respects column sortable setting", () => {
    const columnsWithSortable = [
      { key: "id", header: "ID", sortable: false },
      { key: "name", header: "Name", sortable: true },
    ];

    render(<DataTable columns={columnsWithSortable} data={mockData} />);

    const idHeader = screen.getByText("ID");
    const nameHeader = screen.getByText("Name");

    fireEvent.click(idHeader);
    expect(idHeader.textContent).not.toContain("↑");

    fireEvent.click(nameHeader);
    expect(nameHeader.textContent).toContain("↑");
  });

  it("sorts data alphabetically", () => {
    render(<DataTable columns={mockColumns} data={mockData} />);

    const nameHeader = screen.getByText("Name");
    fireEvent.click(nameHeader);

    const rows = screen.getAllByRole("row");
    // Skip header row
    const dataRows = rows.slice(1);

    expect(dataRows[0].textContent).toContain("Alice");
    expect(dataRows[1].textContent).toContain("Bob");
    expect(dataRows[2].textContent).toContain("Charlie");
  });

  it("sorts data numerically when values are numbers", () => {
    const numericData = [
      { id: 3, value: 30 },
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ];
    const numericColumns = [{ key: "value", header: "Value" }];

    render(<DataTable columns={numericColumns} data={numericData} />);

    const valueHeader = screen.getByText("Value");
    fireEvent.click(valueHeader);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("10");
    expect(rows[1].textContent).toContain("20");
    expect(rows[2].textContent).toContain("30");
  });

  it("uses custom render function for cells", () => {
    const columnsWithRender = [
      {
        key: "name",
        header: "Name",
        render: (value: string) => `Mr/Ms ${value}`,
      },
    ];

    render(<DataTable columns={columnsWithRender} data={[{ name: "Alice" }]} />);

    expect(screen.getByText("Mr/Ms Alice")).toBeInTheDocument();
  });

  it("uses custom getSortValue for sorting", () => {
    const dataWithComplex = [
      { id: 1, display: "Item C", sortOrder: 3 },
      { id: 2, display: "Item A", sortOrder: 1 },
      { id: 3, display: "Item B", sortOrder: 2 },
    ];
    const columnsWithSortValue = [
      {
        key: "display",
        header: "Display",
        getSortValue: (_value: string, row: (typeof dataWithComplex)[0]) => row.sortOrder,
      },
    ];

    render(<DataTable columns={columnsWithSortValue} data={dataWithComplex} />);

    const header = screen.getByText("Display");
    fireEvent.click(header);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0].textContent).toContain("Item A");
    expect(rows[1].textContent).toContain("Item B");
    expect(rows[2].textContent).toContain("Item C");
  });

  it("shows em dash for null/undefined values", () => {
    const dataWithNull = [{ id: 1, name: null, role: undefined }];

    render(<DataTable columns={mockColumns} data={dataWithNull} />);

    const row = screen.getAllByRole("row")[1];
    expect(row.textContent).toContain("—");
  });

  it("renders with correct table structure", () => {
    const { container } = render(<DataTable columns={mockColumns} data={mockData} />);

    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toBeInTheDocument();
  });
});
