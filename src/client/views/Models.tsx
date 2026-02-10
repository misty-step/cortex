import { useEffect, useState } from "react";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";

export function Models() {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/models")
      .then(r => r.json())
      .then(data => {
        setModels(data);
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
          { key: "status", header: "Status", render: (v: string) => <StatusBadge status={v} /> },
        ]}
        data={models}
      />
    </div>
  );
}
