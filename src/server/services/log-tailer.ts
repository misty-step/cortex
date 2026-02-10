import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseGatewayLogLine } from "../parsers/gateway-log.js";
import { parseGatewayErrLine } from "../parsers/gateway-err.js";
import { parseJsonLogLine } from "../parsers/json-log.js";
import type { ParsedLogEntry } from "../types.js";

type LogHandler = (entry: ParsedLogEntry) => void;

const watchers = new Map<string, { close: () => void }>();

export async function startLogTailer(
  logDir: string,
  onEntry: LogHandler,
): Promise<void> {
  // Tail gateway.log
  const gwLogPath = path.join(logDir, "gateway.log");
  watchFile(gwLogPath, parseGatewayLogLine, onEntry);

  // Tail gateway.err.log
  const gwErrPath = path.join(logDir, "gateway.err.log");
  watchFile(gwErrPath, parseGatewayErrLine, onEntry);

  // Tail JSON logs in /tmp/openclaw/
  const jsonLogDir = "/tmp/openclaw";
  try {
    const files = await fs.readdir(jsonLogDir);
    const today = new Date().toISOString().slice(0, 10);
    const todayLog = files.find(f => f.includes(today) && f.endsWith(".log"));
    if (todayLog) {
      watchFile(path.join(jsonLogDir, todayLog), parseJsonLogLine, onEntry);
    }
  } catch {
    // Directory doesn't exist
  }
}

export function stopLogTailer(): void {
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
}

function watchFile(
  filePath: string,
  parser: (line: string) => ParsedLogEntry | null,
  onEntry: LogHandler,
): void {
  try {
    const stream = createReadStream(filePath, { encoding: "utf-8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    
    rl.on("line", (line) => {
      const entry = parser(line);
      if (entry) onEntry(entry);
    });

    watchers.set(filePath, {
      close: () => {
        rl.close();
        stream.destroy();
      },
    });
  } catch {
    // File doesn't exist or can't be read
  }
}
