import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { DataTable } from "../components/DataTable";
import { relativeTime, formatTokens } from "../lib/formatters";
import type { AgentDetail as AgentDetailType } from "../../shared/types";

function OnlineBadge({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        online ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
      }`}
    >
      <span className={`w-2 h-2 rounded-full mr-1 ${online ? "bg-green-500" : "bg-gray-400"}`} />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
      Disabled
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg2)] p-4 rounded-lg">
      <h3 className="text-sm font-semibold text-[var(--fg2)] mb-3 uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatRelative(ts: number | null): string {
  if (!ts) return "\u2014";
  return relativeTime(ts);
}

export function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, loading, error } = useApi<AgentDetailType>(`/api/agents/${id}`);

  if (loading) return <div className="p-4">Loading agent details...</div>;
  if (error) {
    return (
      <div className="p-4">
        <Link to="/agents" className="text-blue-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to Agents
        </Link>
        <div className="text-red-500">Failed to load agent: {error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link to="/agents" className="text-blue-400 hover:underline text-sm">
            &larr; Back to Agents
          </Link>
          <h2 className="text-2xl font-bold mt-1">{data.name}</h2>
          {data.model && <p className="text-sm text-[var(--fg3)]">{data.model.primary}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--fg3)] font-mono">{data.id}</span>
          <OnlineBadge online={data.online} />
          <EnabledBadge enabled={data.enabled} />
        </div>
      </div>

      {/* Configuration */}
      <Section title="Configuration">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-[var(--fg3)]">Workspace</dt>
          <dd className="font-mono text-xs">{data.workspace ?? "\u2014"}</dd>

          <dt className="text-[var(--fg3)]">Primary Model</dt>
          <dd>{data.model?.primary ?? "\u2014"}</dd>

          {data.model && data.model.fallbacks.length > 0 && (
            <>
              <dt className="text-[var(--fg3)]">Fallbacks</dt>
              <dd>{data.model.fallbacks.join(", ")}</dd>
            </>
          )}

          {data.subagents.length > 0 && (
            <>
              <dt className="text-[var(--fg3)]">Subagents</dt>
              <dd>{data.subagents.join(", ")}</dd>
            </>
          )}

          <dt className="text-[var(--fg3)]">Sessions</dt>
          <dd>{data.sessionCount}</dd>
        </dl>
      </Section>

      {/* Auth Profiles */}
      {data.authProfiles.length > 0 && (
        <Section title="Auth Profiles">
          <DataTable
            columns={[
              { key: "provider", header: "Provider" },
              { key: "profileId", header: "Profile" },
              {
                key: "errorCount",
                header: "Errors",
                render: (v: number) => <span className={v > 0 ? "text-red-400" : ""}>{v}</span>,
              },
              {
                key: "lastUsed",
                header: "Last Used",
                render: (v: number | null) => formatRelative(v),
                getSortValue: (v: number | null) => v ?? 0,
              },
              {
                key: "lastFailure",
                header: "Last Failure",
                render: (v: number | null) => formatRelative(v),
                getSortValue: (v: number | null) => v ?? 0,
              },
            ]}
            data={data.authProfiles}
            rowKey="profileId"
          />
        </Section>
      )}

      {/* Available Models */}
      {data.availableModels.length > 0 && (
        <Section title={`Available Models (${data.availableModels.length})`}>
          <DataTable
            columns={[
              { key: "name", header: "Model" },
              { key: "provider", header: "Provider" },
              {
                key: "contextWindow",
                header: "Context",
                render: (v: number | null) => (v ? formatTokens(v) : "\u2014"),
                getSortValue: (v: number | null) => v ?? 0,
              },
              {
                key: "maxTokens",
                header: "Max Tokens",
                render: (v: number | null) => (v ? formatTokens(v) : "\u2014"),
                getSortValue: (v: number | null) => v ?? 0,
              },
              {
                key: "reasoning",
                header: "Reasoning",
                render: (v: boolean) => (v ? "Yes" : "No"),
              },
            ]}
            data={data.availableModels}
            rowKey="id"
          />
        </Section>
      )}

      {/* Sessions */}
      {data.sessions.length > 0 && (
        <Section title={`Sessions (${data.sessions.length})`}>
          <DataTable
            columns={[
              { key: "key", header: "Session Key" },
              {
                key: "model",
                header: "Model",
                render: (v: string | null) => v ?? "\u2014",
              },
              {
                key: "updatedAt",
                header: "Last Activity",
                render: (v: number) => formatRelative(v),
                getSortValue: (v: number) => v,
              },
            ]}
            data={data.sessions}
            rowKey="key"
          />
        </Section>
      )}

      {/* Skills */}
      {data.skills.length > 0 && (
        <Section title={`Skills (${data.skills.length})`}>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-1 bg-[var(--bg3)] rounded text-xs text-[var(--fg2)]"
              >
                {skill}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
