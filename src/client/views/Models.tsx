import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";

type ModelRow = {
  name: string;
  id: string;
  provider: string;
  status: string;
};

export function Models() {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: unknown) => {
        setModels(Array.isArray(data) ? (data as ModelRow[]) : []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Available Models</h2>
      <DataTable
        columns={[
          { key: "name", header: "Name" },
          { key: "id", header: "Model ID" },
          { key: "provider", header: "Provider" },
          {
            key: "status",
            header: "Status",
            render: (v) => <StatusBadge status={typeof v === "string" ? v : String(v ?? "")} />,
          },
        ]}
        data={models}
      />
    </div>
  );
}
