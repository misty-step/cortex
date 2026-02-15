import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { ExportButton } from "../components/ExportButton";
import { SearchBar } from "../components/SearchBar";
import { relativeTime } from "../lib/formatters";
import type { PaginatedResponse } from "../../shared/types";

export function Sessions() {
  const [searchQuery, setSearchQuery] = useState("");
  const params = new URLSearchParams({ limit: "10000" });
  if (searchQuery.trim()) params.set("q", searchQuery.trim());
  const url = `/api/sessions?${params.toString()}`;
  const { data, loading, error } = useApi<PaginatedResponse<Record<string, unknown>>>(url);

  const filteredSessions = useMemo(() => {
    if (!data || error) return [];
    return data.data;
  }, [data, error]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">Failed to load sessions</div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Agent Sessions</h2>
        <div className="flex items-center gap-2">
          {filteredSessions.length > 0 && (
            <ExportButton data={filteredSessions} filename="sessions" />
          )}
          <SearchBar
            onDebouncedSearch={setSearchQuery}
            placeholder="Search sessions..."
            className="w-auto"
          />
        </div>
      </div>
      <DataTable
        columns={[
          { key: "agent_id", header: "Agent", sortable: true },
          {
            key: "session_key",
            header: "Session",
            sortable: false,
            render: (v: string, row: Record<string, unknown>) => {
              const agentId = typeof row.agent_id === "string" ? row.agent_id : "";
              return (
                <Link
                  to={`/sessions/${encodeURIComponent(agentId)}/${encodeURIComponent(v)}`}
                  className="font-mono text-xs text-blue-400 hover:underline"
                  title={v}
                >
                  {v.split(":").slice(-2).join(":")}
                </Link>
              );
            },
          },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (v: string) => <StatusBadge status={v} />,
          },
          {
            key: "model",
            header: "Model",
            sortable: true,
            render: (v: string) => (v ? v.split("/").pop() : "—"),
          },
          {
            key: "last_activity",
            header: "Last Activity",
            sortable: true,
            getSortValue: (v: string | null) => (v ? new Date(v).getTime() : 0),
            render: (v: string | null) => (v ? relativeTime(new Date(v).getTime()) : "—"),
          },
        ]}
        data={filteredSessions}
        rowKey="session_key"
      />
    </div>
  );
}
