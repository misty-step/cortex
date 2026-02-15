/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import { collectSessions } from "../../../src/server/collectors/sessions.js";
import type { SessionInfo } from "../../../src/shared/types.js";

// Mock fs for directory listing only
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
}));

// Mock the service that reads individual agent sessions
vi.mock("../../../src/server/services/session-file-reader.js", () => ({
  readSessionsForAgent: vi.fn(),
}));

// Import the mock after vi.mock so we get the mocked version
import { readSessionsForAgent } from "../../../src/server/services/session-file-reader.js";

const mockReadSessionsForAgent = vi.mocked(readSessionsForAgent);

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

  it("should delegate to readSessionsForAgent for each agent directory", async () => {
    const mockDirent = [{ name: "agent-1", isDirectory: () => true }] as any[];
    const mockSessions: SessionInfo[] = [
      {
        agent_id: "agent-1",
        session_key: "session-abc-123",
        status: "active",
        start_time: "2023-11-14T22:13:20.000Z",
        last_activity: "2023-11-14T23:13:20.000Z",
        current_task: "Testing task",
        model: "moonshotai/kimi-k2.5",
      },
    ];

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    mockReadSessionsForAgent.mockResolvedValue(mockSessions);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      agent_id: "agent-1",
      session_key: "session-abc-123",
      status: "active",
    });
    expect(mockReadSessionsForAgent).toHaveBeenCalledWith(
      "/mock/openclaw/agents/agent-1/sessions/sessions.json",
      "agent-1",
    );
  });

  it("should aggregate sessions from multiple agents", async () => {
    const mockDirent = [
      { name: "agent-a", isDirectory: () => true },
      { name: "agent-b", isDirectory: () => true },
    ] as any[];

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    mockReadSessionsForAgent
      .mockResolvedValueOnce([
        {
          agent_id: "agent-a",
          session_key: "s1",
          status: "active",
          start_time: null,
          last_activity: null,
          current_task: "T1",
        },
        {
          agent_id: "agent-a",
          session_key: "s2",
          status: "idle",
          start_time: null,
          last_activity: null,
          current_task: "T2",
        },
      ])
      .mockResolvedValueOnce([
        {
          agent_id: "agent-b",
          session_key: "s3",
          status: "active",
          start_time: null,
          last_activity: null,
          current_task: "T3",
        },
      ]);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(3);
    expect(result.map((s) => s.session_key)).toEqual(["s1", "s2", "s3"]);
  });

  it("should skip agents whose sessions file does not exist (ENOENT)", async () => {
    const mockDirent = [
      { name: "agent-with-sessions", isDirectory: () => true },
      { name: "agent-no-sessions", isDirectory: () => true },
    ] as any[];

    const enoent = new Error("ENOENT") as NodeJS.ErrnoException;
    enoent.code = "ENOENT";

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    mockReadSessionsForAgent
      .mockResolvedValueOnce([
        {
          agent_id: "agent-with-sessions",
          session_key: "s1",
          status: "active",
          start_time: null,
          last_activity: null,
          current_task: "Task",
        },
      ])
      .mockRejectedValueOnce(enoent);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(result[0]!.agent_id).toBe("agent-with-sessions");
  });

  it("should log non-ENOENT errors and continue", async () => {
    const mockDirent = [
      { name: "agent-1", isDirectory: () => true },
      { name: "agent-2", isDirectory: () => true },
    ] as any[];

    const permError = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    permError.code = "EACCES";

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    mockReadSessionsForAgent
      .mockResolvedValueOnce([
        {
          agent_id: "agent-1",
          session_key: "s1",
          status: "active",
          start_time: null,
          last_activity: null,
          current_task: "Task",
        },
      ])
      .mockRejectedValueOnce(permError);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[collector/sessions] Failed to read sessions for agent agent-2"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });

  it("should skip non-directory entries in agents folder", async () => {
    const mockDirent = [
      { name: "agent-1", isDirectory: () => true },
      { name: "not-a-dir.txt", isDirectory: () => false },
      { name: "another-file", isDirectory: () => false },
    ] as any[];

    vi.mocked(fs.readdir).mockResolvedValue(mockDirent);
    mockReadSessionsForAgent.mockResolvedValue([
      {
        agent_id: "agent-1",
        session_key: "s1",
        status: "active",
        start_time: null,
        last_activity: null,
        current_task: "Task",
      },
    ]);

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toHaveLength(1);
    expect(mockReadSessionsForAgent).toHaveBeenCalledTimes(1);
  });

  it("should log readdir errors and return empty array", async () => {
    const error = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    error.code = "EACCES";
    vi.mocked(fs.readdir).mockRejectedValue(error);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await collectSessions(mockOpenclawHome);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[collector/sessions] Failed to read agents directory"),
      expect.anything(),
    );

    consoleSpy.mockRestore();
  });
});
