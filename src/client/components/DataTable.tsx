import { useState, useMemo } from "react";

interface Column {
  key: string;
  header: string;
  sortable?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: (value: any, row: any) => React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSortValue?: (value: any, row: any) => string | number;
}

interface DataTableProps {
  columns: Column[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  sortable?: boolean;
  emptyMessage?: string;
}

export function DataTable({
  columns,
  data,
  sortable = true,
  emptyMessage = "No data available",
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortable || !sortKey) return data;

    return [...data].sort((a, b) => {
      const column = columns.find((c) => c.key === sortKey);
      const aVal = column?.getSortValue ? column.getSortValue(a[sortKey], a) : (a[sortKey] ?? "");
      const bVal = column?.getSortValue ? column.getSortValue(b[sortKey], b) : (b[sortKey] ?? "");

      // Handle numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDesc ? bVal - aVal : aVal - bVal;
      }

      // String comparison
      const aStr = String(aVal);
      const bStr = String(bVal);
      if (aStr < bStr) return sortDesc ? 1 : -1;
      if (aStr > bStr) return sortDesc ? -1 : 1;
      return 0;
    });
  }, [data, sortKey, sortDesc, sortable, columns]);

  const handleSort = (key: string, columnSortable = true) => {
    if (!sortable || !columnSortable) return;

    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  if (!data.length) {
    return <div className="text-[var(--fg3)] p-4">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--bg3)]">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key, col.sortable !== false)}
                className={`p-3 font-semibold text-[var(--fg2)] select-none ${
                  col.sortable !== false && sortable ? "cursor-pointer hover:text-[var(--fg)]" : ""
                }`}
              >
                {col.header}
                {sortKey === col.key && col.sortable !== false && sortable && (
                  <span className="ml-1">{sortDesc ? "↓" : "↑"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr key={idx} className="border-b border-[var(--bg2)] hover:bg-[var(--bg2)]">
              {columns.map((col) => (
                <td key={col.key} className="p-3 text-[var(--fg)]">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
