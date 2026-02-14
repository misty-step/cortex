import * as fs from "node:fs/promises";
import * as path from "node:path";
import { CronExpressionParser } from "cron-parser";
import type { CronJob } from "../../shared/types.js";

export function calculateNextRun(
  schedule: { kind: string; expr?: string; everyMs?: number; tz?: string },
  fromDate: Date = new Date(),
): string | null {
  if (!schedule) return null;

  try {
    if (schedule.kind === "cron" && schedule.expr) {
      const interval = CronExpressionParser.parse(schedule.expr, {
        currentDate: fromDate,
        tz: schedule.tz ?? "UTC", // Default to UTC if no timezone specified
      });
      return interval.next().toISOString();
    }

    if (schedule.kind === "every" && schedule.everyMs) {
      // For interval-based schedules, next run is last run + interval, or now + interval if no last run
      return new Date(fromDate.getTime() + schedule.everyMs).toISOString();
    }
  } catch {
    // Invalid cron expression or parsing error
    return null;
  }

  return null;
}

export async function collectCrons(openclawHome: string): Promise<CronJob[]> {
  const crons: CronJob[] = [];
  const jobsFile = path.join(openclawHome, "cron", "jobs.json");

  try {
    const content = await fs.readFile(jobsFile, "utf-8");
    const data = JSON.parse(content);

    if (data.jobs && Array.isArray(data.jobs)) {
      for (const job of data.jobs) {
        const schedule = job.schedule;
        let scheduleStr = "unknown";

        if (schedule.kind === "cron" && schedule.expr) {
          scheduleStr = schedule.expr;
          if (schedule.tz) scheduleStr += ` (${schedule.tz})`;
        } else if (schedule.kind === "every" && schedule.everyMs) {
          const mins = Math.floor(schedule.everyMs / 60000);
          scheduleStr = `every ${mins}m`;
        }

        const lastRun = job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs) : null;
        const nextRun = calculateNextRun(schedule, lastRun ?? new Date());

        crons.push({
          id: job.id,
          name: job.name,
          agent_id: job.agentId,
          schedule: scheduleStr,
          last_run: lastRun?.toISOString() ?? null,
          next_run: nextRun,
          status: job.enabled ? "active" : "disabled",
          last_status: job.state?.lastStatus || "—",
        });
      }
    }
  } catch (err) {
    console.error("Failed to read cron jobs:", err);
  }

  return crons;
}
