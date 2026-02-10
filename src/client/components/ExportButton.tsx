import { useState } from "react";

interface ExportButtonProps {
  data: any[];
  filename?: string;
}

export function ExportButton({ data, filename = "export" }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const exportCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => 
      Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="px-3 py-1.5 bg-[var(--blue)] text-white rounded text-sm font-medium hover:bg-[var(--blue-dark)]"
      >
        Export
      </button>
      {showMenu && (
        <div className="absolute right-0 mt-1 w-32 bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg z-10">
          <button
            onClick={exportJSON}
            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg2)]"
          >
            Export JSON
          </button>
          <button
            onClick={exportCSV}
            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg2)]"
          >
            Export CSV
          </button>
        </div>
      )}
    </div>
  );
}
