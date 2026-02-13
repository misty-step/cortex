import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import type { LogEntry } from "../../shared/types";

export function Errors() {
  const [errors, setErrors] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/errors")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setErrors(Array.isArray(data) ? data : (data?.data ?? []));
      })
      .catch(() => {
        setErrors([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Recent Errors</h2>
      <DataTable
        columns={[
          { key: "timestamp", header: "Time" },
          { key: "level", header: "Level" },
          { key: "message", header: "Message" },
        ]}
        data={errors}
      />
    </div>
  );
}
