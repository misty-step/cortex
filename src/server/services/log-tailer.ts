import { createReadStream, statSync, watchFile, unwatchFile } from "node:fs";
import { createInterface } from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseGatewayLogLine } from "../parsers/gateway-log.js";
import { parseGatewayErrLine } from "../parsers/gateway-err.js";
import { parseJsonLogLine } from "../parsers/json-log.js";
import type { ParsedLogEntry } from "../types.js";
import type { LogSource } from "../../shared/types.js";

export type LogBatch = { entry: ParsedLogEntry; source: LogSource }[];
type LogBatchHandler = (entries: LogBatch) => void;

const watchers = new Map<string, { close: () => void }>();

export async function startLogTailer(logDir: string, onBatch: LogBatchHandler): Promise<void> {
  const gwLogPath = path.join(logDir, "gateway.log");
  tailFile(gwLogPath, parseGatewayLogLine, "gateway-log", onBatch);

  const gwErrPath = path.join(logDir, "gateway.err.log");
  tailFile(gwErrPath, parseGatewayErrLine, "gateway-err", onBatch);

  const jsonLogDir = "/tmp/openclaw";
  try {
    const files = await fs.readdir(jsonLogDir);
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = files.find((f) => f.includes(today) && f.endsWith(".log"));
    if (todayLog) {
      tailFile(path.join(jsonLogDir, todayLog), parseJsonLogLine, "json-log", onBatch);
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
  onBatch: LogBatchHandler,
): void {
  let offset = 0;
  let reading = false;

  try {
    // Start tailing from current end of file — skip historical data
    offset = statSync(filePath).size;
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
      readFrom(filePath, offset, curr.size, parser, source, onBatch, (newOffset) => {
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
  endOffset: number,
  parser: (line: string) => ParsedLogEntry | null,
  source: LogSource,
  onBatch: LogBatchHandler,
  onDone: (newOffset: number) => void,
): void {
  const stream = createReadStream(filePath, {
    encoding: "utf-8",
    start: startOffset,
    end: endOffset > startOffset ? endOffset - 1 : undefined,
  });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  const MAX_BATCH = 500;
  let batch: LogBatch = [];

  rl.on("line", (line) => {
    const entry = parser(line);
    if (entry) {
      batch.push({ entry, source });
      if (batch.length >= MAX_BATCH) {
        onBatch(batch);
        batch = [];
      }
    }
  });

  rl.on("close", () => {
    if (batch.length > 0) onBatch(batch);
    onDone(endOffset);
    stream.destroy();
  });

  stream.on("error", () => {
    // Reset so future polls can retry
    onDone(startOffset);
    stream.destroy();
  });
}
