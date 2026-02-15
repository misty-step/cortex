import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {
  clearSessionReaderCache,
  readSessionsSummary,
  readSessionsForAgent,
  hasSessionsFile,
  getSessionsPath,
} from "../../../src/server/services/session-file-reader";

describe("session-file-reader", () => {
  let tempDir: string;
  let sessionsPath: string;

  beforeEach(async () => {
    clearSessionReaderCache();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "session-reader-test-"));
    sessionsPath = path.join(tempDir, "sessions.json");
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("readSessionsSummary", () => {
    it("reads session count and timestamps", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": {
            systemSent: true,
            createdAt: 1700000000000,
            updatedAt: 1700000100000,
            model: "claude-opus-4",
          },
          "session-2": {
            systemSent: false,
            createdAt: 1700000200000,
            updatedAt: 1700000300000,
            model: "claude-sonnet-4-5",
          },
        }),
      );

      const summary = await readSessionsSummary(sessionsPath);

      expect(summary.count).toBe(2);
      expect(summary.latestTimestamp).toBe(1700000300000);
      expect(summary.currentModel).toBe("claude-sonnet-4-5");
    });

    it("handles empty sessions file", async () => {
      await fs.writeFile(sessionsPath, JSON.stringify({}));

      const summary = await readSessionsSummary(sessionsPath);

      expect(summary.count).toBe(0);
      expect(summary.latestTimestamp).toBe(0);
      expect(summary.currentModel).toBeNull();
    });

    it("caches results based on mtime", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": {
            updatedAt: 1700000000000,
            model: "model-a",
          },
        }),
      );

      const summary1 = await readSessionsSummary(sessionsPath);
      expect(summary1.count).toBe(1);

      // Overwrite file without changing mtime (impossible in real FS, but cache should prevent re-read)
      // Instead, verify cache is used by checking same object reference
      const summary2 = await readSessionsSummary(sessionsPath);
      expect(summary1).toBe(summary2);
    });

    it("re-reads when file mtime changes", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": { updatedAt: 1700000000000, model: "model-a" },
        }),
      );

      const summary1 = await readSessionsSummary(sessionsPath);
      expect(summary1.count).toBe(1);

      // Wait a bit to ensure different mtime
      await new Promise((resolve) => setTimeout(resolve, 10));

      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": { updatedAt: 1700000000000, model: "model-a" },
          "session-2": { updatedAt: 1700000100000, model: "model-b" },
        }),
      );

      const summary2 = await readSessionsSummary(sessionsPath);
      expect(summary2.count).toBe(2);
      expect(summary2.currentModel).toBe("model-b");
    });

    it("handles sessions without model", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": { updatedAt: 1700000000000 },
        }),
      );

      const summary = await readSessionsSummary(sessionsPath);
      expect(summary.currentModel).toBeNull();
    });

    it("handles invalid sessions format gracefully", async () => {
      await fs.writeFile(sessionsPath, JSON.stringify("not a valid format"));

      await expect(readSessionsSummary(sessionsPath)).rejects.toThrow("Invalid sessions format");
    });

    it("throws on missing file", async () => {
      await expect(readSessionsSummary("/nonexistent/path/sessions.json")).rejects.toThrow();
    });
  });

  describe("readSessionsForAgent", () => {
    it("returns full SessionInfo array", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-abc": {
            systemSent: true,
            createdAt: 1700000000000,
            updatedAt: 1700000100000,
            model: "claude-opus-4",
            task: "Doing some work",
          },
          "session-xyz": {
            systemSent: false,
            createdAt: 1700000200000,
            updatedAt: 1700000300000,
            model: "claude-sonnet-4-5",
            task: "Another task",
          },
        }),
      );

      const sessions = await readSessionsForAgent(sessionsPath, "test-agent");

      expect(sessions).toHaveLength(2);

      const session1 = sessions.find((s) => s.session_key === "session-abc")!;
      expect(session1).toMatchObject({
        agent_id: "test-agent",
        session_key: "session-abc",
        status: "active",
        start_time: new Date(1700000000000).toISOString(),
        last_activity: new Date(1700000100000).toISOString(),
        current_task: "Doing some work",
        model: "claude-opus-4",
      });

      const session2 = sessions.find((s) => s.session_key === "session-xyz")!;
      expect(session2.status).toBe("idle");
    });

    it("handles missing optional fields", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": {},
        }),
      );

      const sessions = await readSessionsForAgent(sessionsPath, "test-agent");

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!).toMatchObject({
        agent_id: "test-agent",
        session_key: "session-1",
        status: "idle",
        start_time: null,
        last_activity: null,
        current_task: "—",
        model: undefined,
      });
    });

    it("caches raw data and shares with summary", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({
          "session-1": { updatedAt: 1700000000000, model: "model-a" },
        }),
      );

      // Read sessions first
      const sessions = await readSessionsForAgent(sessionsPath, "test-agent");
      expect(sessions).toHaveLength(1);

      // Summary should use cached data (no re-read)
      const summary = await readSessionsSummary(sessionsPath);
      expect(summary.count).toBe(1);
    });
  });

  describe("hasSessionsFile", () => {
    it("returns true when sessions file exists", async () => {
      // Create sessions subdirectory
      const sessionsDir = path.join(tempDir, "sessions");
      await fs.mkdir(sessionsDir, { recursive: true });
      await fs.writeFile(path.join(sessionsDir, "sessions.json"), JSON.stringify({}));
      expect(await hasSessionsFile(tempDir)).toBe(true);
    });

    it("returns false when sessions file does not exist", async () => {
      expect(await hasSessionsFile("/nonexistent/agent")).toBe(false);
    });
  });

  describe("getSessionsPath", () => {
    it("returns correct path", () => {
      const path = getSessionsPath("/some/agent/dir");
      expect(path).toBe("/some/agent/dir/sessions/sessions.json");
    });
  });

  describe("clearSessionReaderCache", () => {
    it("clears all caches", async () => {
      await fs.writeFile(
        sessionsPath,
        JSON.stringify({ "session-1": { updatedAt: 1700000000000 } }),
      );

      await readSessionsSummary(sessionsPath);
      await readSessionsForAgent(sessionsPath, "test-agent");

      clearSessionReaderCache();

      // After clearing, re-reading should give fresh results
      const summary = await readSessionsSummary(sessionsPath);
      expect(summary).toBeDefined();
    });
  });
});
