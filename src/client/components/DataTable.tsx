import { useState } from "react";

type RowLike = Record<string, unknown>;

interface Column<T extends object> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends object> {
  columns: Array<Column<T>>;
  data: T[];
}

function compareValues(aVal: unknown, bVal: unknown): number {
  if (aVal === bVal) return 0;
  if (aVal === null || aVal === undefined) return -1;
  if (bVal === null || bVal === undefined) return 1;
  if (typeof aVal === "number" && typeof bVal === "number") return aVal - bVal;
  const aStr = typeof aVal === "string" ? aVal : String(aVal);
  const bStr = typeof bVal === "string" ? bVal : String(bVal);
  return aStr.localeCompare(bStr);
}

function formatCellValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString();

  try {
    const s = JSON.stringify(v);
    return s.length > 200 ? `${s.slice(0, 197)}...` : s;
  } catch {
    return String(v);
  }
}

function getRowValue<T extends object>(row: T, key: string): unknown {
  return (row as unknown as RowLike)[key];
}

export function DataTable<T extends object>({ columns, data }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const diff = compareValues(getRowValue(a, sortKey), getRowValue(b, sortKey));
    return sortDesc ? -diff : diff;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(false);
    }
  };

  if (!data.length) {
    return <div className="text-[var(--fg3)] p-4">No data available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-[var(--bg3)]">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="p-3 font-semibold text-[var(--fg2)] cursor-pointer hover:text-[var(--fg)] select-none"
              >
                {col.header}
                {sortKey === col.key && <span className="ml-1">{sortDesc ? "↓" : "↑"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, idx) => (
            <tr key={idx} className="border-b border-[var(--bg2)] hover:bg-[var(--bg2)]">
              {columns.map((col) => (
                <td key={col.key} className="p-3 text-[var(--fg)]">
                  {col.render
                    ? col.render(getRowValue(row, col.key), row)
                    : formatCellValue(getRowValue(row, col.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
