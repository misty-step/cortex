import type { ParsedLogEntry } from "../types.js";

export function parseJsonLogLine(line: string): ParsedLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    
    // Format 1: { type: "log", time, level, subsystem, message }
    if (parsed.type === "log") {
      return {
        time: parsed.time || new Date().toISOString(),
        level: parsed.level || "info",
        subsystem: parsed.subsystem || "unknown",
        message: parsed.message || "",
        ts: new Date(parsed.time || Date.now()).getTime(),
      };
    }
    
    // Format 2: Raw numbered args with _meta
    if (parsed._meta) {
      const meta = parsed._meta;
      return {
        time: meta.date || new Date().toISOString(),
        level: meta.logLevelName || "info",
        subsystem: meta.name || "unknown",
        message: Object.entries(parsed)
          .filter(([k]) => k !== "_meta")
          .map(([, v]) => String(v))
          .join(" "),
        ts: new Date(meta.date || Date.now()).getTime(),
      };
    }
    
    return null;
  } catch {
    return null;
  }
}
