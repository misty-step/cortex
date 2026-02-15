import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { StatusBadge } from "../components/StatusBadge";
import { relativeTime } from "../lib/formatters";
import type { SessionDetail as SessionDetailType, SessionMessage } from "../../shared/types";

function MessageBubble({ message }: { message: SessionMessage }) {
  const ts = message.timestampMs ? relativeTime(message.timestampMs) : "";

  if (message.kind === "thinking") {
    return <ThinkingMessage message={message} ts={ts} />;
  }

  if (message.kind === "tool") {
    return (
      <div className="flex gap-3 py-2">
        <div className="w-6 h-6 rounded bg-[var(--bg3)] flex items-center justify-center text-xs text-[var(--fg3)] shrink-0 mt-0.5">
          T
        </div>
        <div className="flex-1 min-w-0">
          <pre className="font-mono text-xs text-[var(--fg2)] whitespace-pre-wrap break-words bg-[var(--bg2)] rounded px-3 py-2">
            {message.text}
          </pre>
          <span className="text-[10px] text-[var(--fg3)] mt-1 block">{ts}</span>
        </div>
      </div>
    );
  }

  if (message.role === "user" || message.kind === "user") {
    return (
      <div className="flex gap-3 py-2">
        <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words">
            {message.text}
          </div>
          <span className="text-[10px] text-[var(--fg3)] mt-1 block">{ts}</span>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 py-2">
      <div className="w-6 h-6 rounded bg-[var(--bg3)] text-[var(--fg2)] flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
        A
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-[var(--bg2)] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words">
          {message.text}
        </div>
        <span className="text-[10px] text-[var(--fg3)] mt-1 block">{ts}</span>
      </div>
    </div>
  );
}

function ThinkingMessage({ message, ts }: { message: SessionMessage; ts: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-3 py-2">
      <div className="w-6 h-6 rounded bg-[var(--bg3)] text-[var(--fg3)] flex items-center justify-center text-xs shrink-0 mt-0.5">
        ...
      </div>
      <div className="flex-1 min-w-0">
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-[var(--fg3)] italic hover:text-[var(--fg2)] cursor-pointer"
        >
          {open ? "Hide" : "Show"} thinking
          {!open && message.text.length > 0 && (
            <span className="ml-1 text-[var(--fg3)]">({message.text.length} chars)</span>
          )}
        </button>
        {open && (
          <div className="mt-2 bg-[var(--bg2)] rounded-lg px-4 py-3 text-sm text-[var(--fg3)] italic whitespace-pre-wrap break-words">
            {message.text}
          </div>
        )}
        <span className="text-[10px] text-[var(--fg3)] mt-1 block">{ts}</span>
      </div>
    </div>
  );
}

function truncateKey(key: string): string {
  const parts = key.split(":");
  return parts.length > 2 ? parts.slice(-2).join(":") : key;
}

function safeRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime();
  return isNaN(ms) ? "invalid date" : relativeTime(ms);
}

export function SessionDetail() {
  const { agentId = "", sessionKey = "" } = useParams<{ agentId: string; sessionKey: string }>();
  const { data, loading, error } = useApi<SessionDetailType>(
    `/api/sessions/${encodeURIComponent(agentId)}/${encodeURIComponent(sessionKey)}`,
  );

  if (!agentId || !sessionKey) {
    return <div className="p-4 text-red-500">Invalid session URL</div>;
  }
  if (loading) return <div className="p-4">Loading session details...</div>;
  if (error) {
    return (
      <div className="p-4">
        <Link to="/sessions" className="text-blue-400 hover:underline text-sm mb-4 inline-block">
          &larr; Back to Sessions
        </Link>
        <div className="text-red-500">Failed to load session: {error}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link to="/sessions" className="text-blue-400 hover:underline text-sm">
            &larr; Back to Sessions
          </Link>
          <h2 className="text-2xl font-bold mt-1">{data.agentId}</h2>
          <p className="text-sm text-[var(--fg3)] font-mono" title={data.sessionKey}>
            {truncateKey(data.sessionKey)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {data.model && <span className="text-[var(--fg3)]">{data.model.split("/").pop()}</span>}
          <StatusBadge status={data.status} />
        </div>
      </div>

      {/* Metadata bar */}
      <div className="bg-[var(--bg2)] rounded-lg px-4 py-3">
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
          {data.startTime && (
            <>
              <dt className="text-[var(--fg3)]">Started</dt>
              <dd>{safeRelativeTime(data.startTime)}</dd>
            </>
          )}
          {data.lastActivity && (
            <>
              <dt className="text-[var(--fg3)]">Last activity</dt>
              <dd>{safeRelativeTime(data.lastActivity)}</dd>
            </>
          )}
          {data.currentTask && (
            <>
              <dt className="text-[var(--fg3)]">Task</dt>
              <dd>{data.currentTask}</dd>
            </>
          )}
          <dt className="text-[var(--fg3)]">Messages</dt>
          <dd>{data.messages.length}</dd>
        </dl>
      </div>

      {/* Messages timeline */}
      <div className="bg-[var(--bg2)] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[var(--fg2)] mb-3 uppercase tracking-wide">
          Messages
        </h3>
        {data.messages.length === 0 ? (
          <p className="text-[var(--fg3)] text-sm">No messages recorded for this session</p>
        ) : (
          <div className="space-y-1 divide-y divide-[var(--bg3)]">
            {data.messages.map((msg, idx) => (
              <MessageBubble key={msg.id || `${msg.timestampMs}-${idx}`} message={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
