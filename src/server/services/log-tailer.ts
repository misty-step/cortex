import { createReadStream, statSync, watchFile, unwatchFile } from "node:fs";
import { createInterface } from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseGatewayLogLine } from "../parsers/gateway-log.js";
import { parseGatewayErrLine } from "../parsers/gateway-err.js";
import { parseJsonLogLine } from "../parsers/json-log.js";
import type { ParsedLogEntry } from "../types.js";
import type { LogSource } from "../../shared/types.js";

type LogHandler = (entry: ParsedLogEntry, source: LogSource) => void;

const watchers = new Map<string, { close: () => void }>();

export async function startLogTailer(logDir: string, onEntry: LogHandler): Promise<void> {
  // Tail gateway.log
  const gwLogPath = path.join(logDir, "gateway.log");
  tailFile(gwLogPath, parseGatewayLogLine, "gateway-log", onEntry);

  // Tail gateway.err.log
  const gwErrPath = path.join(logDir, "gateway.err.log");
  tailFile(gwErrPath, parseGatewayErrLine, "gateway-err", onEntry);

  // Tail JSON logs in /tmp/openclaw/
  const jsonLogDir = "/tmp/openclaw";
  try {
    const files = await fs.readdir(jsonLogDir);
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = files.find((f) => f.includes(today) && f.endsWith(".log"));
    if (todayLog) {
      tailFile(path.join(jsonLogDir, todayLog), parseJsonLogLine, "json-log", onEntry);
    }
  } catch {
    // Directory doesn't exist yet
  }
}

export function stopLogTailer(): void {
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
}

function tailFile(
  filePath: string,
  parser: (line: string) => ParsedLogEntry | null,
  source: LogSource,
  onEntry: LogHandler,
): void {
  // Track how far we've read
  let offset = 0;

  // Check if file exists before attempting to read
  try {
    const stat = statSync(filePath);
    offset = 0; // Start from beginning on first read
    readFrom(filePath, offset, parser, source, onEntry, (newOffset) => {
      offset = newOffset;
    });
    offset = stat.size; // After initial read, only watch for new content
  } catch {
    // File doesn't exist yet — watchFile will pick it up when created
  }

  // Poll for changes (works even if file doesn't exist yet)
  watchFile(filePath, { interval: 2000 }, (curr, _prev) => {
    if (curr.size > offset) {
      readFrom(filePath, offset, parser, source, onEntry, (newOffset) => {
        offset = newOffset;
      });
    }
  });

  watchers.set(filePath, {
    close: () => unwatchFile(filePath),
  });
}

function readFrom(
  filePath: string,
  startOffset: number,
  parser: (line: string) => ParsedLogEntry | null,
  source: LogSource,
  onEntry: LogHandler,
  onDone: (newOffset: number) => void,
): void {
  const stream = createReadStream(filePath, {
    encoding: "utf-8",
    start: startOffset,
  });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let bytesRead = startOffset;

  rl.on("line", (line) => {
    bytesRead += Buffer.byteLength(line, "utf-8") + 1; // +1 for newline
    const entry = parser(line);
    if (entry) onEntry(entry, source);
  });

  rl.on("close", () => {
    onDone(bytesRead);
    stream.destroy();
  });

  stream.on("error", () => {
    stream.destroy();
  });
}
