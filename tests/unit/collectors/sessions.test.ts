/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import { collectSessions } from "../../../src/server/collectors/sessions.js";

// Mock fs module with factory function
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

describe("collectSessions", () => {
  const mockOpenclawHome = "/mock/openclaw";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when agents directory does not exist", async () => {
    const error = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    vi.mocked(fs.readdir).mockRejectedValue(error);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toEqual([]);
  });

  it("should return empty array when agents directory is empty", async () => {
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toEqual([]);
  });

  it("should parse sessions from a single agent", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-abc-123": {
        systemSent: true,
        createdAt: 1700000000000,
        updatedAt: 1700003600000,
        task: "Testing task",
        model: "moonshotai/kimi-k2.5",
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      agent_id: "agent-1",
      session_key: "session-abc-123",
      status: "active",
      start_time: "2023-11-14T22:13:20.000Z",
      last_activity: "2023-11-14T23:13:20.000Z",
      current_task: "Testing task",
      model: "moonshotai/kimi-k2.5",
    });
  });

  it("should mark session as idle when systemSent is false", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-def-456": {
        systemSent: false,
        createdAt: 1700000000000,
        updatedAt: 1700003600000,
        task: "Idle task",
        model: "anthropic/claude-sonnet-4",
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]!.status).toBe("idle");
  });

  it("should handle sessions without timestamps", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-no-time": {
        systemSent: true,
        task: "Task without timestamps",
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]).toMatchObject({
      start_time: null,
      last_activity: null,
      current_task: "Task without timestamps",
    });
  });

  it("should use '—' as default for missing task", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-no-task": {
        systemSent: true,
        createdAt: 1700000000000,
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]!.current_task).toBe("—");
  });

  it("should handle missing model field", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-no-model": {
        systemSent: true,
        createdAt: 1700000000000,
        task: "Task",
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]!.model).toBeUndefined();
  });

  it("should parse multiple agents with multiple sessions each", async () => {
    const mockDirent = [
      { name: "agent-a", isDirectory: () => true },
      { name: "agent-b", isDirectory: () => true },
    ] as any[];

    const mockSessionsA = {
      "session-a1": { systemSent: true, createdAt: 1700000000000, task: "Task A1" },
      "session-a2": { systemSent: false, createdAt: 1700000100000, task: "Task A2" },
    };

    const mockSessionsB = {
      "session-b1": { systemSent: true, createdAt: 1700000200000, task: "Task B1" },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes("agent-a")) {
        return Promise.resolve(JSON.stringify(mockSessionsA));
      }
      if (pathStr.includes("agent-b")) {
        return Promise.resolve(JSON.stringify(mockSessionsB));
      }
      return Promise.reject(new Error("File not found"));
    });

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.session_key)).toContain("session-a1");
    expect(result.map((s) => s.session_key)).toContain("session-a2");
    expect(result.map((s) => s.session_key)).toContain("session-b1");
    expect(result.filter((s) => s.agent_id === "agent-a")).toHaveLength(2);
    expect(result.filter((s) => s.agent_id === "agent-b")).toHaveLength(1);
  });

  it("should skip agents without sessions.json file", async () => {
    const mockDirent = [
      { name: "agent-with-sessions", isDirectory: () => true },
      { name: "agent-no-sessions", isDirectory: () => true },
    ] as any[];

    const mockSessions = {
      "session-1": { systemSent: true, createdAt: 1700000000000, task: "Task" },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes("agent-with-sessions")) {
        return Promise.resolve(JSON.stringify(mockSessions));
      }
      const error = new Error("ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      return Promise.reject(error);
    });

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(result[0]!.agent_id).toBe("agent-with-sessions");
  });

  it("should handle malformed JSON gracefully", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue("not valid json");

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("should handle non-directory entries in agents folder", async () => {
    const mockDirent = [
      { name: "agent-1", isDirectory: () => true },
      { name: "not-a-dir.txt", isDirectory: () => false },
      { name: "another-file", isDirectory: () => false },
    ] as any[];

    const mockSessions = {
      "session-1": { systemSent: true, createdAt: 1700000000000, task: "Task" },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(result[0]!.agent_id).toBe("agent-1");
  });

  it("should handle nested error in readFile (non-ENOENT)", async () => {
    const mockDirent = [
      { name: "agent-1", isDirectory: () => true },
      { name: "agent-2", isDirectory: () => true },
    ] as any[];

    const mockSessions = {
      "session-1": { systemSent: true, createdAt: 1700000000000, task: "Task" },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockImplementation((filepath) => {
      const pathStr = String(filepath);
      if (pathStr.includes("agent-1")) {
        return Promise.resolve(JSON.stringify(mockSessions));
      }
      // agent-2 has permission error
      const error = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
      error.code = "EACCES";
      return Promise.reject(error);
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[collector/sessions] Failed to read sessions for agent agent-2"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it("should correctly construct the sessions file path", async () => {
    const mockDirent = [{ name: "my-agent", isDirectory: () => true }] as any[];

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue("{}");

    await collectSessions(mockOpenclawHome);

    expect(fs.readFile).toHaveBeenCalledWith(
      "/mock/openclaw/agents/my-agent/sessions/sessions.json",
      "utf-8",
    );
  });

  it("should handle session with empty task string", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-empty-task": {
        systemSent: true,
        createdAt: 1700000000000,
        task: "",
        model: "test-model",
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]!.current_task).toBe("—");
  });

  it("should handle complex session data types", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];

    const mockSessions = {
      "session-complex": {
        systemSent: 1, // truthy number
        createdAt: 1700000000000, // numeric timestamp
        updatedAt: null,
        task: 123, // number task (preserved as-is via type cast)
        model: null,
      },
    };

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockSessions));

    const result = await collectSessions(mockOpenclawHome);

    expect(result[0]).toMatchObject({
      agent_id: "agent-1",
      session_key: "session-complex",
      status: "active", // 1 is truthy
      current_task: 123, // number preserved (type cast only)
      model: null,
    });
  });
});
