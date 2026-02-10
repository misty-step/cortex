import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface CronJob {
  id: string;
  name: string;
  agent_id: string;
  schedule: string;
  last_run: string | null;
  next_run: string | null;
  status: string;
  last_status: string;
}

// Parse cron expression to get next run time (simplified)
function getNextRun(expr: string, tz?: string): string | null {
  // For now, return placeholder - in production would use cron-parser
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
        
        crons.push({
          id: job.id,
          name: job.name,
          agent_id: job.agentId,
          schedule: scheduleStr,
          last_run: job.state?.lastRunAtMs ? new Date(job.state.lastRunAtMs).toISOString() : null,
          next_run: null, // Would need cron-parser library
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
