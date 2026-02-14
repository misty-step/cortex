import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mocks
const { mockExecFile, mockReadFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockReadFile: vi.fn(),
}));

// Mock child_process before imports
vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

// Mock fs before imports  
vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

// Import after mocks
import { collectSprites } from "../../../src/server/collectors/sprites";

describe("collectSprites", () => {
  const mockOpenclawHome = "/home/test/.openclaw";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockExecFileCallback(
    implementations: Record<string, { stdout?: string; error?: Error }>,
  ) {
    return (
      cmd: string,
      _args: unknown,
      _opts: unknown,
      callback?: (err: Error | null, result?: { stdout: string }) => void,
    ) => {
      if (callback) {
        const impl = implementations[cmd];
        if (impl?.error) {
          callback(impl.error);
        } else {
          callback(null, { stdout: impl?.stdout ?? "" });
        }
      }
      return { on: vi.fn() };
    };
  }

  it("should return sprites with running status when processes found", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name   status\nbramble   active\nfern   idle\n" },
        pgrep: { stdout: "1234 node bramble claude\n5678 node fern codex\n" },
      }),
    );

    mockReadFile.mockRejectedValue({ code: "ENOENT" } as NodeJS.ErrnoException);

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites).toHaveLength(2);
    expect(sprites[0]!.name).toBe("bramble");
    expect(sprites[0]!.status).toBe("running");
    expect(sprites[0]!.agent_count).toBe(1);
    expect(sprites[1]!.name).toBe("fern");
    expect(sprites[1]!.status).toBe("running");
  });

  it("should return idle status when no processes found", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name   status\nmoss   idle\n" },
        pgrep: { stdout: "" },
      }),
    );

    mockReadFile.mockRejectedValue({ code: "ENOENT" } as NodeJS.ErrnoException);

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.name).toBe("moss");
    expect(sprites[0]!.status).toBe("idle");
    expect(sprites[0]!.agent_count).toBe(0);
  });

  it("should extract task and runtime from session data", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name   status\nclover   active\n" },
        pgrep: { stdout: "1234 node clover claude\n" },
      }),
    );

    const sessionData = {
      "session-123": {
        task: "Testing sprite fleet status",
        createdAt: Date.now() - 300000, // 5 minutes ago
        updatedAt: Date.now(),
        systemSent: true,
      },
    };

    mockReadFile.mockResolvedValue(JSON.stringify(sessionData));

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites).toHaveLength(1);
    expect(sprites[0]!.assigned_task).toBe("Testing sprite fleet status");
    expect(sprites[0]!.runtime_seconds).toBe(300);
    expect(sprites[0]!.status).toBe("running");
  });

  it("should mark completed sessions as complete", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name   status\nthistle   idle\n" },
        pgrep: { stdout: "" },
      }),
    );

    const sessionData = {
      "session-456": {
        task: "Finished task",
        createdAt: Date.now() - 600000,
        updatedAt: Date.now() - 10000, // 10 seconds ago
        systemSent: true,
      },
    };

    mockReadFile.mockResolvedValue(JSON.stringify(sessionData));

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites[0]!.status).toBe("complete");
  });

  it("should mark stale incomplete sessions as dead", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name   status\nthorn   idle\n" },
        pgrep: { stdout: "" },
      }),
    );

    const sessionData = {
      "session-789": {
        task: "Abandoned task",
        createdAt: Date.now() - 600000,
        updatedAt: Date.now() - 400000, // Over 5 minutes ago
        systemSent: false,
      },
    };

    mockReadFile.mockResolvedValue(JSON.stringify(sessionData));

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites[0]!.status).toBe("dead");
  });

  it("should fallback to known sprite names when sprite list fails", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { error: new Error("sprite command failed") },
        pgrep: { stdout: "" },
      }),
    );

    mockReadFile.mockRejectedValue({ code: "ENOENT" } as NodeJS.ErrnoException);

    const sprites = await collectSprites(mockOpenclawHome);

    // Should have all 8 known sprites
    expect(sprites.length).toBeGreaterThan(0);
    const names = sprites.map((s) => s.name);
    expect(names).toContain("bramble");
    expect(names).toContain("sage");
  });

  it("should sort running sprites first", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name\nfern\nbramble\nmoss\n" },
        pgrep: { stdout: "1234 node bramble claude\n" },
      }),
    );

    mockReadFile.mockRejectedValue({ code: "ENOENT" } as NodeJS.ErrnoException);

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites[0]!.name).toBe("bramble"); // running comes first
    expect(sprites[0]!.status).toBe("running");
  });

  it("should handle cadence-ui mapping to cadence agent", async () => {
    mockExecFile.mockImplementation(
      mockExecFileCallback({
        sprite: { stdout: "name\ncadence-ui\n" },
        pgrep: { stdout: "" },
      }),
    );

    const sessionData = {
      "session-abc": {
        task: "Cadence task",
        createdAt: Date.now() - 100000,
        updatedAt: Date.now(),
      },
    };

    // Should read from cadence agent dir, not cadence-ui
    mockReadFile.mockImplementation((filepath: unknown) => {
      const fp = String(filepath);
      if (fp.includes("/agents/cadence/")) {
        return Promise.resolve(JSON.stringify(sessionData));
      }
      return Promise.reject({ code: "ENOENT" } as NodeJS.ErrnoException);
    });

    const sprites = await collectSprites(mockOpenclawHome);

    expect(sprites[0]!.name).toBe("cadence-ui");
    expect(sprites[0]!.assigned_task).toBe("Cadence task");
  });
});
