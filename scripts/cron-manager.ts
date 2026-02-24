#!/usr/bin/env node
/**
 * Unified Cron Manager
 *
 * Manages background tasks in a single process:
 * - Review queue expiration (every 5 minutes)
 * - Rankings update (every 24 hours)
 *
 * Usage:
 *   npm run cron                    # run all tasks
 *   npm run cron -- --rankings-only # run rankings task only
 *   npm run cron -- --once          # run once then exit
 */

import { createAdminClient } from "../src/lib/supabase/admin";
import { createSupabaseReviewQueue } from "../src/lib/ai/review-queue";
import {
  log,
  logSeparator,
  validateEnvironment,
  testDatabaseConnection,
  setupGracefulShutdown,
} from "./lib/script-helpers";

const RANKINGS_ONLY = process.argv.includes("--rankings-only");
const RUN_ONCE = process.argv.includes("--once") || process.argv.includes("-o");

const INTERVALS = {
  RANKINGS: 24 * 60 * 60 * 1000,
  REVIEW_EXPIRE: 5 * 60 * 1000,
};

interface TaskStats {
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  successCount: number;
  errorCount: number;
  lastDuration: number;
}

const taskStats: Record<string, TaskStats> = {
  rankings: {
    lastRun: null,
    nextRun: null,
    runCount: 0,
    successCount: 0,
    errorCount: 0,
    lastDuration: 0,
  },
  reviewExpire: {
    lastRun: null,
    nextRun: null,
    runCount: 0,
    successCount: 0,
    errorCount: 0,
    lastDuration: 0,
  },
};

async function updateRankings(): Promise<boolean> {
  const taskName = "rankings";
  const stats = taskStats[taskName];

  try {
    stats.lastRun = new Date();
    stats.runCount++;

    log("[Rankings] Starting update...", "info");
    const startTime = Date.now();

    const supabase = createAdminClient();
    const { error } = await supabase.rpc("fn_update_post_rankings");

    if (error) {
      log(`[Rankings] Failed: ${error.message}`, "error");
      stats.errorCount++;
      return false;
    }

    const duration = Date.now() - startTime;
    stats.lastDuration = duration;

    const [{ count: hotCount }, { count: risingCount }] = await Promise.all([
      supabase.from("post_rankings").select("*", { count: "exact", head: true }).gt("hot_rank", 0),
      supabase
        .from("post_rankings")
        .select("*", { count: "exact", head: true })
        .gt("rising_rank", 0),
    ]);

    log(`[Rankings] Completed in ${duration}ms`, "success");
    log(`[Rankings]   - Hot posts: ${hotCount ?? 0}`, "info");
    log(`[Rankings]   - Rising posts: ${risingCount ?? 0}`, "info");

    stats.successCount++;
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Rankings] Error: ${errorMessage}`, "error");
    stats.errorCount++;
    return false;
  }
}

async function expireReviewQueue(): Promise<boolean> {
  const taskName = "reviewExpire";
  const stats = taskStats[taskName];

  try {
    stats.lastRun = new Date();
    stats.runCount++;
    const startTime = Date.now();

    const queue = createSupabaseReviewQueue();
    const expired = await queue.expireDue({ now: new Date() });

    stats.lastDuration = Date.now() - startTime;
    stats.successCount++;

    if (expired.length > 0) {
      log(`[Review Queue] Expired ${expired.length} item(s)`, "warning");
    } else {
      log("[Review Queue] No items expired", "info");
    }

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Review Queue] Error: ${errorMessage}`, "error");
    stats.errorCount++;
    return false;
  }
}

function scheduleTask(
  taskName: string,
  taskFn: () => Promise<boolean>,
  intervalMs: number,
): NodeJS.Timeout | null {
  taskStats[taskName].nextRun = new Date(Date.now() + intervalMs);

  return setInterval(async () => {
    try {
      await taskFn();
    } catch (err) {
      log(`[Scheduler] Unhandled error in ${taskName}`, "error");
      console.error(err);
    }

    taskStats[taskName].nextRun = new Date(Date.now() + intervalMs);
  }, intervalMs);
}

function printStats(): void {
  logSeparator();
  log("Task Statistics", "info");
  logSeparator();

  for (const [taskName, stats] of Object.entries(taskStats)) {
    const successRate =
      stats.runCount > 0 ? ((stats.successCount / stats.runCount) * 100).toFixed(1) : "0.0";

    log(`${taskName}:`, "info");
    log(`  Runs: ${stats.runCount} (✅ ${stats.successCount}, ❌ ${stats.errorCount})`, "info");
    log(`  Success Rate: ${successRate}%`, "info");
    log(`  Last Run: ${stats.lastRun?.toISOString() || "Never"}`, "info");
    log(`  Next Run: ${stats.nextRun?.toISOString() || "N/A"}`, "info");
    log(`  Last Duration: ${stats.lastDuration}ms`, "info");
    log("", "info");
  }
}

async function main(): Promise<void> {
  logSeparator();
  log("Unified Cron Manager", "info");
  logSeparator();

  if (RANKINGS_ONLY) {
    log("Mode: RANKINGS ONLY", "warning");
  } else if (RUN_ONCE) {
    log("Mode: ONCE (run all tasks immediately, no scheduling)", "warning");
  } else {
    log("Mode: CONTINUOUS (all tasks scheduled)", "info");
  }
  log("", "info");

  await validateEnvironment();
  await testDatabaseConnection();

  log("", "info");

  if (RUN_ONCE) {
    log("Running all tasks once...", "info");
    logSeparator();

    const tasks = [];

    if (!RANKINGS_ONLY) {
      tasks.push(expireReviewQueue());
    }

    tasks.push(updateRankings());

    await Promise.all(tasks);

    log("", "info");
    printStats();
    process.exit(0);
  }

  log("Starting scheduler...", "info");
  log("", "info");

  const timers: NodeJS.Timeout[] = [];

  if (!RANKINGS_ONLY) {
    log("Scheduling: Review Queue Expire (every 5 minutes)", "info");
    await expireReviewQueue();
    const expireTimer = scheduleTask("reviewExpire", expireReviewQueue, INTERVALS.REVIEW_EXPIRE);
    if (expireTimer) timers.push(expireTimer);
  }

  log("Scheduling: Rankings Update (every 24 hours)", "info");
  await updateRankings();
  const rankingsTimer = scheduleTask("rankings", updateRankings, INTERVALS.RANKINGS);
  if (rankingsTimer) timers.push(rankingsTimer);

  log("", "info");
  log("All tasks scheduled!", "success");
  log("Press Ctrl+C to stop", "warning");
  log("", "info");

  setInterval(
    () => {
      printStats();
    },
    60 * 60 * 1000,
  );

  process.stdin.resume();
}

setupGracefulShutdown();

main().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  log(`Unhandled error: ${errorMessage}`, "error");
  console.error(err);
  process.exit(1);
});
