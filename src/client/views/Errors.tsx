import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { ExportButton } from "../components/ExportButton";
import type { LogEntry } from "../../shared/types";

export function Errors() {
  const { data: raw, loading } = useApi<LogEntry[] | { data: LogEntry[] }>("/api/errors");

  const errors: LogEntry[] = raw ? (Array.isArray(raw) ? raw : (raw.data ?? [])) : [];

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Recent Errors</h2>
        {errors.length > 0 && <ExportButton data={errors} filename="errors" />}
      </div>
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
