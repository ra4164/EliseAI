import cron from "node-cron";
import {
  pendingLeads,
  setEnriching,
  setEnrichment,
  setFailed,
} from "./store";
import { enrichLead } from "./enrich";
import { logger } from "./logger";

export interface ScheduleStatus {
  cronExpression: string;
  friendlySchedule: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunSucceeded: number | null;
  lastRunFailed: number | null;
  isRunning: boolean;
}

let lastRunAt: string | null = null;
let lastRunSucceeded: number | null = null;
let lastRunFailed: number | null = null;
let isRunning = false;

const CRON_EXPRESSION = "0 9 * * *"; // 09:00 every day

function computeNextRunAt(): string | null {
  try {
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    if (next.getHours() < 9 || (next.getHours() === 9 && next.getMinutes() === 0)) {
      next.setHours(9, 0, 0, 0);
    } else {
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
    }
    return next.toISOString();
  } catch {
    return null;
  }
}

export async function runEnrichAll(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (isRunning) {
    logger.warn("Scheduler: enrichAll already running, skipping");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const pending = await pendingLeads();
  if (pending.length === 0) {
    logger.info("Scheduler: no pending leads to enrich");
    lastRunAt = new Date().toISOString();
    lastRunSucceeded = 0;
    lastRunFailed = 0;
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  isRunning = true;
  logger.info({ count: pending.length }, "Scheduler: starting enrichAll");

  let succeeded = 0;
  let failed = 0;

  await Promise.allSettled(
    pending.map(async (lead) => {
      await setEnriching(lead.id);
      try {
        const enrichment = await enrichLead(lead);
        await setEnrichment(lead.id, enrichment);
        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await setFailed(lead.id, msg);
        failed++;
        logger.error({ leadId: lead.id, err }, "Scheduler: failed to enrich lead");
      }
    }),
  );

  lastRunAt = new Date().toISOString();
  lastRunSucceeded = succeeded;
  lastRunFailed = failed;
  isRunning = false;

  logger.info(
    { processed: pending.length, succeeded, failed },
    "Scheduler: enrichAll complete",
  );

  return { processed: pending.length, succeeded, failed };
}

export function getScheduleStatus(): ScheduleStatus {
  return {
    cronExpression: CRON_EXPRESSION,
    friendlySchedule: "Daily at 9:00 AM",
    nextRunAt: computeNextRunAt(),
    lastRunAt,
    lastRunSucceeded,
    lastRunFailed,
    isRunning,
  };
}

export function startScheduler(): void {
  cron.schedule(CRON_EXPRESSION, async () => {
    logger.info("Scheduler: cron fired — running enrichAll");
    await runEnrichAll();
  });

  logger.info({ cron: CRON_EXPRESSION }, "Scheduler: registered daily 9 AM job");
}
