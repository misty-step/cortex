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
  const gwLogPath = path.join(logDir, "gateway.log");
  tailFile(gwLogPath, parseGatewayLogLine, "gateway-log", onEntry);

  const gwErrPath = path.join(logDir, "gateway.err.log");
  tailFile(gwErrPath, parseGatewayErrLine, "gateway-err", onEntry);

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
  let offset = 0;
  let reading = false;

  try {
    const stat = statSync(filePath);
    reading = true;
    readFrom(filePath, 0, parser, source, onEntry, (newOffset) => {
      offset = newOffset;
      reading = false;
    });
    offset = stat.size;
  } catch {
    // File doesn't exist yet — watchFile will pick it up when created
  }

  watchFile(filePath, { interval: 2000 }, (curr, _prev) => {
    if (reading) return;

    // Handle log rotation/truncation: reset to beginning
    if (curr.size < offset) {
      offset = 0;
    }

    if (curr.size > offset) {
      reading = true;
      readFrom(filePath, offset, parser, source, onEntry, (newOffset) => {
        offset = newOffset;
        reading = false;
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

  const batch: { entry: ParsedLogEntry; source: LogSource }[] = [];

  rl.on("line", (line) => {
    const entry = parser(line);
    if (entry) batch.push({ entry, source });
  });

  rl.on("close", () => {
    // Flush batch at once — lets caller wrap in a transaction
    for (const item of batch) {
      onEntry(item.entry, item.source);
    }
    // Use actual file size instead of manual byte counting
    try {
      onDone(statSync(filePath).size);
    } catch {
      onDone(startOffset);
    }
    stream.destroy();
  });

  stream.on("error", () => {
    stream.destroy();
  });
}
