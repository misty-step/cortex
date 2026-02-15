import { useMemo } from "react";

// ─── Regex-based lightweight markdown renderer ─────────────────────────────
// Handles: code blocks, inline code, bold, headers, stack traces.
// Zero dependencies.

interface MarkdownContentProps {
  content: string;
  className?: string;
}

interface Block {
  type: "code" | "text";
  content: string;
  lang?: string;
}

const FENCED_CODE = /^```(\w*)\n([\s\S]*?)^```$/gm;
const STACK_TRACE_LINE = /^\s+at\s+.+[:(]\d+[):]/;

function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(FENCED_CODE)) {
    const before = text.slice(lastIndex, match.index);
    if (before) blocks.push({ type: "text", content: before });
    blocks.push({ type: "code", content: match[2] ?? "", lang: match[1] || undefined });
    lastIndex = (match.index ?? 0) + match[0].length;
  }

  const remaining = text.slice(lastIndex);
  if (remaining) blocks.push({ type: "text", content: remaining });
  return blocks;
}

function isStackTrace(text: string): boolean {
  const lines = text.split("\n");
  let traceLines = 0;
  for (const line of lines) {
    if (STACK_TRACE_LINE.test(line)) traceLines++;
    if (traceLines >= 2) return true;
  }
  return false;
}

/** Render inline markdown: `code`, **bold** */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match inline code or bold
  const inline = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let lastIdx = 0;
  let key = 0;

  for (const m of text.matchAll(inline)) {
    const before = text.slice(lastIdx, m.index);
    if (before) parts.push(before);

    if (m[1] !== undefined) {
      parts.push(
        <code key={key++} className="bg-[var(--bg3)] px-1 py-0.5 rounded text-sm font-mono">
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      parts.push(
        <strong key={key++} className="font-semibold">
          {m[2]}
        </strong>,
      );
    }

    lastIdx = (m.index ?? 0) + m[0].length;
  }

  const tail = text.slice(lastIdx);
  if (tail) parts.push(tail);
  return parts;
}

function renderTextBlock(text: string): React.ReactNode {
  // Check for stack trace
  if (isStackTrace(text)) {
    return (
      <pre className="bg-[var(--bg3)] p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre text-red-400">
        {text.trim()}
      </pre>
    );
  }

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trimStart();

    // Headers
    const headerMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headerMatch?.[1] && headerMatch[2]) {
      const level = headerMatch[1].length;
      const sizes = [
        "text-lg font-bold",
        "text-base font-bold",
        "text-sm font-semibold",
        "text-sm font-medium",
      ] as const;
      elements.push(
        <div key={i} className={`${sizes[Math.min(level, 4) - 1] ?? sizes[3]} mt-1`}>
          {renderInline(headerMatch[2])}
        </div>,
      );
      continue;
    }

    // Non-empty line with inline formatting
    if (trimmed) {
      elements.push(
        <span key={i}>
          {renderInline(line)}
          {"\n"}
        </span>,
      );
    } else {
      elements.push(<span key={i}>{"\n"}</span>);
    }
  }

  return <span className="whitespace-pre-wrap">{elements}</span>;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const rendered = useMemo(() => {
    if (!content) return null;

    const blocks = splitBlocks(content);

    return blocks.map((block, i) => {
      if (block.type === "code") {
        return (
          <pre
            key={i}
            className="bg-[var(--bg3)] p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre my-1"
          >
            {block.content.trim()}
          </pre>
        );
      }
      return <span key={i}>{renderTextBlock(block.content)}</span>;
    });
  }, [content]);

  return <div className={className ?? "max-w-prose"}>{rendered}</div>;
}
