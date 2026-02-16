import { useState, useMemo } from "react";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { filterByText } from "../lib/formatters";
import type { PaginatedResponse } from "../../shared/types";

export function Models() {
  const [searchQuery, setSearchQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const { data, loading, error } =
    useApi<PaginatedResponse<Record<string, unknown>>>("/api/models?limit=10000");
  const models = useMemo(() => data?.data ?? [], [data]);

  // Get unique providers for filter dropdown (filter out undefined/null)
  const providers = [...new Set(models.map((m) => m.provider as string).filter(Boolean))].sort();

  // Apply provider filter, then text search
  const filteredModels = useMemo(() => {
    const byProvider = providerFilter
      ? models.filter((m) => m.provider === providerFilter)
      : models;
    return filterByText(byProvider, searchQuery, ["name", "id", "provider"]);
  }, [models, providerFilter, searchQuery]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load models</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Available Models</h2>
        <div className="flex items-center gap-2">
          {filteredModels.length > 0 && <ExportButton data={filteredModels} filename="models" />}
          <SearchBar
            onDebouncedSearch={setSearchQuery}
            placeholder="Search models..."
            className="w-auto"
          />
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="bg-[var(--bg2)] border rounded px-2 py-1"
            aria-label="Filter by provider"
          >
            <option value="">All Providers</option>
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>
      <DataTable
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "id", header: "Model ID", sortable: true },
          { key: "provider", header: "Provider", sortable: true },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (v: string) => <StatusBadge status={v} />,
          },
        ]}
        data={filteredModels}
      />
    </div>
  );
}
