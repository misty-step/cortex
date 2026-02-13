import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";

export function Models() {
  const { data, loading } = useApi<Record<string, unknown>[]>("/api/models");
  const models = data ?? [];

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Available Models</h2>
        {models.length > 0 && <ExportButton data={models} filename="models" />}
      </div>
      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "id", header: "Model ID" },
          { key: "provider", header: "Provider" },
          { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
        ]}
        data={models}
      />
    </div>
  );
}
