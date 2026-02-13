import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// We need to mock watchFile to control timing, but keep real file I/O for readFrom
const originalFs = { ...fs };
const watchCallbacks = new Map<string, (curr: fs.Stats, prev: fs.Stats) => void>();

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    watchFile: vi.fn(
      (filePath: string, _opts: unknown, cb: (curr: fs.Stats, prev: fs.Stats) => void) => {
        watchCallbacks.set(filePath as string, cb);
      },
    ),
    unwatchFile: vi.fn((filePath: string) => {
      watchCallbacks.delete(filePath as string);
    }),
  };
});

// Helper to simulate a file change detected by watchFile
function triggerFileChange(filePath: string) {
  const cb = watchCallbacks.get(filePath);
  if (cb) {
    const stat = originalFs.statSync(filePath);
    cb(stat, stat);
  }
}

describe("log-tailer", () => {
  let tmpDir: string;

  beforeEach(() => {
    watchCallbacks.clear();
    tmpDir = originalFs.mkdtempSync(path.join(os.tmpdir(), "tailer-test-"));
  });

  afterEach(async () => {
    const { stopLogTailer } = await import("../../../src/server/services/log-tailer");
    stopLogTailer();
    originalFs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should export startLogTailer and stopLogTailer functions", async () => {
    const mod = await import("../../../src/server/services/log-tailer");
    expect(typeof mod.startLogTailer).toBe("function");
    expect(typeof mod.stopLogTailer).toBe("function");
  });

  it("should call stopLogTailer without error when no watchers exist", async () => {
    const { stopLogTailer } = await import("../../../src/server/services/log-tailer");
    expect(() => stopLogTailer()).not.toThrow();
  });

  it("should set up watchers for gateway.log and gateway.err.log", async () => {
    originalFs.writeFileSync(path.join(tmpDir, "gateway.log"), "");
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const { startLogTailer } = await import("../../../src/server/services/log-tailer");
    await startLogTailer(tmpDir, () => {});

    // Should have registered watchers for both files
    expect(watchCallbacks.has(path.join(tmpDir, "gateway.log"))).toBe(true);
    expect(watchCallbacks.has(path.join(tmpDir, "gateway.err.log"))).toBe(true);
  });

  it("should parse new gateway.log lines when file grows", async () => {
    const logFile = path.join(tmpDir, "gateway.log");
    originalFs.writeFileSync(logFile, "");
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const batches: Array<{ entry: { message: string }; source: string }[]> = [];
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await startLogTailer(tmpDir, (batch) => {
      batches.push(batch);
    });

    // Append new log line after tailing started
    originalFs.appendFileSync(logFile, "2026-02-12T10:00:00.000Z [gateway] New event detected\n");

    // Trigger the watcher callback
    triggerFileChange(logFile);

    // Wait for readline to process
    await new Promise((r) => setTimeout(r, 100));

    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allEntries = batches.flat();
    expect(allEntries[0]!.entry.message).toBe("New event detected");
    expect(allEntries[0]!.source).toBe("gateway-log");
  });

  it("should parse new gateway.err.log lines when file grows", async () => {
    originalFs.writeFileSync(path.join(tmpDir, "gateway.log"), "");
    const errFile = path.join(tmpDir, "gateway.err.log");
    originalFs.writeFileSync(errFile, "");

    const batches: Array<{ entry: { message: string; level: string }; source: string }[]> = [];
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await startLogTailer(tmpDir, (batch) => {
      batches.push(batch);
    });

    originalFs.appendFileSync(errFile, "2026-02-12T10:00:00.000Z Fatal error occurred\n");
    triggerFileChange(errFile);

    await new Promise((r) => setTimeout(r, 100));

    expect(batches.length).toBeGreaterThanOrEqual(1);
    const allEntries = batches.flat();
    expect(allEntries[0]!.entry.message).toBe("Fatal error occurred");
    expect(allEntries[0]!.entry.level).toBe("error");
    expect(allEntries[0]!.source).toBe("gateway-err");
  });

  it("should handle multiple lines in a single file change", async () => {
    const logFile = path.join(tmpDir, "gateway.log");
    originalFs.writeFileSync(logFile, "");
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const batches: Array<{ entry: { message: string }; source: string }[]> = [];
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await startLogTailer(tmpDir, (batch) => {
      batches.push(batch);
    });

    const lines = [
      "2026-02-12T10:00:00.000Z [gateway] Line one\n",
      "2026-02-12T10:00:01.000Z [gateway] Line two\n",
      "2026-02-12T10:00:02.000Z [gateway] Line three\n",
    ].join("");

    originalFs.appendFileSync(logFile, lines);
    triggerFileChange(logFile);

    await new Promise((r) => setTimeout(r, 100));

    const allEntries = batches.flat();
    expect(allEntries).toHaveLength(3);
  });

  it("should skip unparseable lines", async () => {
    const logFile = path.join(tmpDir, "gateway.log");
    originalFs.writeFileSync(logFile, "");
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const batches: Array<{ entry: { message: string }; source: string }[]> = [];
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await startLogTailer(tmpDir, (batch) => {
      batches.push(batch);
    });

    originalFs.appendFileSync(
      logFile,
      "invalid line\n2026-02-12T10:00:00.000Z [gateway] Valid line\nanother invalid\n",
    );
    triggerFileChange(logFile);

    await new Promise((r) => setTimeout(r, 100));

    const allEntries = batches.flat();
    expect(allEntries).toHaveLength(1);
    expect(allEntries[0]!.entry.message).toBe("Valid line");
  });

  it("should handle log rotation (file truncation)", async () => {
    const logFile = path.join(tmpDir, "gateway.log");
    // Pre-fill the file with enough content so offset is large
    const initialContent =
      "2026-02-12T09:00:00.000Z [gateway] Old line one that is quite long to make file bigger\n" +
      "2026-02-12T09:00:01.000Z [gateway] Old line two also long enough\n" +
      "2026-02-12T09:00:02.000Z [gateway] Old line three with extra data\n";
    originalFs.writeFileSync(logFile, initialContent);
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const batches: Array<{ entry: { message: string }; source: string }[]> = [];
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await startLogTailer(tmpDir, (batch) => {
      batches.push(batch);
    });

    // Simulate rotation: truncate to a smaller file
    originalFs.writeFileSync(logFile, "2026-02-12T11:00:00.000Z [gateway] Rotated\n");
    triggerFileChange(logFile);

    await new Promise((r) => setTimeout(r, 100));

    // After rotation, offset resets and reads from beginning
    const allEntries = batches.flat();
    expect(allEntries.length).toBeGreaterThanOrEqual(1);
    expect(allEntries.some((e) => e.entry.message === "Rotated")).toBe(true);
  });

  it("should remove all watchers when stopLogTailer is called", async () => {
    originalFs.writeFileSync(path.join(tmpDir, "gateway.log"), "");
    originalFs.writeFileSync(path.join(tmpDir, "gateway.err.log"), "");

    const { startLogTailer, stopLogTailer } =
      await import("../../../src/server/services/log-tailer");
    await startLogTailer(tmpDir, () => {});

    const watcherCountBefore = watchCallbacks.size;
    expect(watcherCountBefore).toBeGreaterThanOrEqual(2);

    stopLogTailer();

    // unwatchFile was called for each watched file
    expect(fs.unwatchFile).toHaveBeenCalled();
  });

  it("should handle missing log files gracefully when starting", async () => {
    // Don't create any files in tmpDir
    const { startLogTailer } = await import("../../../src/server/services/log-tailer");

    await expect(startLogTailer(tmpDir, () => {})).resolves.toBeUndefined();
  });
});
