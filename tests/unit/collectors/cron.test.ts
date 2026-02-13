import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import { collectCrons, calculateNextRun } from "../../../src/server/collectors/cron";

// Mock fs module
vi.mock("node:fs/promises");

describe("calculateNextRun", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T08:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return next run for cron expression", () => {
    const schedule = {
      kind: "cron",
      expr: "0 9 * * *", // 9 AM daily
    };

    const result = calculateNextRun(schedule);

    // Should be 9 AM on the current day (or next day if already past 9 AM)
    expect(result).toMatch(/2026-02-13T\d{2}:00:00\.000Z/);
    // Since we're at 08:00 UTC, next run should be at 09:00 UTC
    expect(new Date(result!).getUTCHours()).toBe(9);
  });

  it("should handle timezone in cron expression", () => {
    const schedule = {
      kind: "cron",
      expr: "0 9 * * *",
      tz: "America/New_York",
    };

    const result = calculateNextRun(schedule);

    // Result should be a valid ISO timestamp
    expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    // 9 AM EST in February is 14:00 UTC
    expect(new Date(result!).getUTCHours()).toBe(14);
  });

  it("should return next run for interval-based schedule", () => {
    const schedule = {
      kind: "every",
      everyMs: 60000, // 1 minute
    };

    const result = calculateNextRun(schedule);

    expect(result).toBe("2026-02-13T08:01:00.000Z");
  });

  it("should calculate from provided last run date for interval", () => {
    const schedule = {
      kind: "every",
      everyMs: 300000, // 5 minutes
    };
    const lastRun = new Date("2026-02-13T07:30:00.000Z");

    const result = calculateNextRun(schedule, lastRun);

    expect(result).toBe("2026-02-13T07:35:00.000Z");
  });

  it("should return null for invalid cron expression", () => {
    const schedule = {
      kind: "cron",
      expr: "invalid",
    };

    const result = calculateNextRun(schedule);

    expect(result).toBeNull();
  });

  it("should return null for null schedule", () => {
    const result = calculateNextRun(null as unknown as { kind: string });

    expect(result).toBeNull();
  });

  it("should return null for unknown schedule kind", () => {
    const schedule = {
      kind: "unknown",
    };

    const result = calculateNextRun(schedule);

    expect(result).toBeNull();
  });
});

describe("collectCrons", () => {
  const mockOpenclawHome = "/mock/openclaw";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-13T08:00:00.000Z"));
    vi.mocked(fs.readFile).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return empty array when jobs file does not exist", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toEqual([]);
  });

  it("should parse cron jobs with all fields", async () => {
    const mockJobs = {
      jobs: [
        {
          id: "job-1",
          name: "Test Job",
          agentId: "test-agent",
          enabled: true,
          schedule: {
            kind: "cron",
            expr: "0 */6 * * *",
            tz: "UTC",
          },
          state: {
            lastRunAtMs: new Date("2026-02-13T06:00:00.000Z").getTime(),
            lastStatus: "ok",
          },
        },
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toHaveLength(1);
    const job1 = result[0]!;
    expect(job1).toMatchObject({
      id: "job-1",
      name: "Test Job",
      agent_id: "test-agent",
      schedule: "0 */6 * * * (UTC)",
      status: "active",
      last_status: "ok",
      last_run: "2026-02-13T06:00:00.000Z",
    });
    expect(job1.next_run).toBeDefined();
  });

  it("should handle interval-based schedules", async () => {
    const mockJobs = {
      jobs: [
        {
          id: "job-2",
          name: "Interval Job",
          agentId: "interval-agent",
          enabled: false,
          schedule: {
            kind: "every",
            everyMs: 300000, // 5 minutes
          },
          state: {},
        },
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toHaveLength(1);
    const job2 = result[0]!;
    expect(job2).toMatchObject({
      id: "job-2",
      name: "Interval Job",
      agent_id: "interval-agent",
      schedule: "every 5m",
      status: "disabled",
      last_status: "—",
      last_run: null,
    });
    expect(job2.next_run).toBe("2026-02-13T08:05:00.000Z");
  });

  it("should handle jobs without state", async () => {
    const mockJobs = {
      jobs: [
        {
          id: "job-3",
          name: "No State Job",
          agentId: "stateless-agent",
          enabled: true,
          schedule: {
            kind: "cron",
            expr: "0 12 * * *",
          },
        },
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toHaveLength(1);
    const job3 = result[0]!;
    expect(job3).toMatchObject({
      id: "job-3",
      name: "No State Job",
      last_run: null,
      last_status: "—",
      status: "active",
    });
  });

  it("should handle empty jobs array", async () => {
    const mockJobs = { jobs: [] };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toEqual([]);
  });

  it("should handle missing jobs property", async () => {
    const mockJobs = {};

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toEqual([]);
  });

  it("should handle multiple jobs", async () => {
    const mockJobs = {
      jobs: [
        {
          id: "job-a",
          name: "Job A",
          agentId: "agent-a",
          enabled: true,
          schedule: { kind: "cron", expr: "0 * * * *" },
          state: { lastRunAtMs: Date.now(), lastStatus: "ok" },
        },
        {
          id: "job-b",
          name: "Job B",
          agentId: "agent-b",
          enabled: true,
          schedule: { kind: "every", everyMs: 60000 },
          state: { lastRunAtMs: Date.now(), lastStatus: "error" },
        },
      ],
    };

    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockJobs));

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Job A");
    expect(result[1]!.name).toBe("Job B");
  });

  it("should handle invalid JSON gracefully", async () => {
    vi.mocked(fs.readFile).mockResolvedValue("not valid json");

    const result = await collectCrons(mockOpenclawHome);

    expect(result).toEqual([]);
  });
});
