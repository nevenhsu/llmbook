#!/usr/bin/env node
/**
 * Unified Cron Manager
 *
 * Manages all background tasks in a single process:
 * - Karma queue processing (every 5 minutes)
 * - Karma full refresh (every hour)
 * - Rankings update (every 24 hours)
 *
 * Usage:
 *   npm run cron                    # 啟動所有任務
 *   npm run cron -- --karma-only    # 只執行 karma 任務
 *   npm run cron -- --rankings-only # 只執行 rankings 任務
 *   npm run cron -- --once          # 立即執行所有任務一次後退出
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createAdminClient } from "../src/lib/supabase/admin";
import { createSupabaseReviewQueue } from "../src/lib/ai/review-queue";
import { runInPostgresTransaction } from "../src/lib/supabase/postgres";
import {
  log,
  logSeparator,
  validateEnvironment,
  testDatabaseConnection,
  setupGracefulShutdown,
} from "./lib/script-helpers";

// Parse command line arguments
const KARMA_ONLY = process.argv.includes("--karma-only");
const RANKINGS_ONLY = process.argv.includes("--rankings-only");
const RUN_ONCE = process.argv.includes("--once") || process.argv.includes("-o");

// Task intervals (in milliseconds)
const INTERVALS = {
  KARMA_QUEUE: 5 * 60 * 1000, // 5 minutes
  KARMA_FULL: 60 * 60 * 1000, // 1 hour
  RANKINGS: 24 * 60 * 60 * 1000, // 24 hours
  REVIEW_EXPIRE: 5 * 60 * 1000, // 5 minutes
};

// Task state
interface TaskStats {
  lastRun: Date | null;
  nextRun: Date | null;
  runCount: number;
  successCount: number;
  errorCount: number;
  lastDuration: number;
}

const taskStats: Record<string, TaskStats> = {
  karmaQueue: {
    lastRun: null,
    nextRun: null,
    runCount: 0,
    successCount: 0,
    errorCount: 0,
    lastDuration: 0,
  },
  karmaFull: {
    lastRun: null,
    nextRun: null,
    runCount: 0,
    successCount: 0,
    errorCount: 0,
    lastDuration: 0,
  },
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

// ============================================================================
// Task Functions
// ============================================================================

async function processKarmaQueue(): Promise<boolean> {
  const taskName = "karmaQueue";
  const stats = taskStats[taskName];

  try {
    stats.lastRun = new Date();
    stats.runCount++;

    log("[Karma Queue] Processing...", "info");
    const startTime = Date.now();

    const supabase = createAdminClient();

    // Check queue size
    const { count: queueSize } = await supabase
      .from("karma_refresh_queue")
      .select("*", { count: "exact", head: true });

    if (queueSize === 0) {
      log("[Karma Queue] Queue is empty, skipping", "info");
      stats.successCount++;
      stats.lastDuration = Date.now() - startTime;
      return true;
    }

    log(`[Karma Queue] Queue size: ${queueSize} items`, "info");

    // Process queue in direct SQL transaction
    await runInPostgresTransaction(async (tx) => {
      await tx.query("select public.process_karma_refresh_queue()");
    });

    const duration = Date.now() - startTime;
    stats.lastDuration = duration;

    // Check remaining
    const { count: remainingCount } = await supabase
      .from("karma_refresh_queue")
      .select("*", { count: "exact", head: true });

    log(`[Karma Queue] Processed ${queueSize} items in ${duration}ms`, "success");
    log(`[Karma Queue] Remaining: ${remainingCount ?? 0} items`, "info");

    stats.successCount++;
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Karma Queue] Error: ${errorMessage}`, "error");
    stats.errorCount++;
    return false;
  }
}

async function refreshAllKarma(): Promise<boolean> {
  const taskName = "karmaFull";
  const stats = taskStats[taskName];

  try {
    stats.lastRun = new Date();
    stats.runCount++;

    log("[Karma Full] Starting full refresh...", "info");
    const startTime = Date.now();

    const supabase = createAdminClient();

    // Refresh all karma in direct SQL transaction
    await runInPostgresTransaction(async (tx) => {
      await tx.query("select public.refresh_all_karma()");
    });

    const duration = Date.now() - startTime;
    stats.lastDuration = duration;

    // Get stats
    const [{ count: profileCount }, { count: personaCount }, { count: mvCount }] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).gt("karma", 0),
        supabase.from("personas").select("*", { count: "exact", head: true }).gt("karma", 0),
        supabase.from("user_karma_stats").select("*", { count: "exact", head: true }),
      ]);

    log(`[Karma Full] Completed in ${duration}ms`, "success");
    log(`[Karma Full]   - Profiles: ${profileCount ?? 0}`, "info");
    log(`[Karma Full]   - Personas: ${personaCount ?? 0}`, "info");
    log(`[Karma Full]   - MV Records: ${mvCount ?? 0}`, "info");

    stats.successCount++;
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`[Karma Full] Error: ${errorMessage}`, "error");
    stats.errorCount++;
    return false;
  }
}

async function updateRankings(): Promise<boolean> {
  const taskName = "rankings";
  const stats = taskStats[taskName];

  try {
    stats.lastRun = new Date();
    stats.runCount++;

    log("[Rankings] Starting update...", "info");
    const startTime = Date.now();

    const supabase = createAdminClient();

    // Update rankings
    const { error } = await supabase.rpc("fn_update_post_rankings");

    if (error) {
      log(`[Rankings] Failed: ${error.message}`, "error");
      stats.errorCount++;
      return false;
    }

    const duration = Date.now() - startTime;
    stats.lastDuration = duration;

    // Get stats
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

// ============================================================================
// Scheduler
// ============================================================================

function scheduleTask(
  taskName: string,
  taskFn: () => Promise<boolean>,
  intervalMs: number,
): NodeJS.Timeout | null {
  // Update next run time
  taskStats[taskName].nextRun = new Date(Date.now() + intervalMs);

  return setInterval(async () => {
    try {
      await taskFn();
    } catch (err) {
      log(`[Scheduler] Unhandled error in ${taskName}`, "error");
      console.error(err);
    }

    // Update next run time
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

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  logSeparator();
  log("Unified Cron Manager", "info");
  logSeparator();

  // Show mode
  if (KARMA_ONLY) {
    log("Mode: KARMA ONLY", "warning");
  } else if (RANKINGS_ONLY) {
    log("Mode: RANKINGS ONLY", "warning");
  } else if (RUN_ONCE) {
    log("Mode: ONCE (run all tasks immediately, no scheduling)", "warning");
  } else {
    log("Mode: CONTINUOUS (all tasks scheduled)", "info");
  }
  log("", "info");

  // Validate environment
  await validateEnvironment();

  // Test connection
  await testDatabaseConnection();

  log("", "info");

  // Run once mode: execute all tasks and exit
  if (RUN_ONCE) {
    log("Running all tasks once...", "info");
    logSeparator();

    const tasks = [];

    if (!RANKINGS_ONLY) {
      tasks.push(processKarmaQueue());
      tasks.push(refreshAllKarma());
      tasks.push(expireReviewQueue());
    }

    if (!KARMA_ONLY) {
      tasks.push(updateRankings());
    }

    await Promise.all(tasks);

    log("", "info");
    printStats();
    process.exit(0);
  }

  // Continuous mode: schedule tasks
  log("Starting scheduler...", "info");
  log("", "info");

  const timers: NodeJS.Timeout[] = [];

  if (!RANKINGS_ONLY) {
    // Karma queue - every 5 minutes
    log("Scheduling: Karma Queue (every 5 minutes)", "info");
    await processKarmaQueue(); // Run immediately
    const queueTimer = scheduleTask("karmaQueue", processKarmaQueue, INTERVALS.KARMA_QUEUE);
    if (queueTimer) timers.push(queueTimer);

    // Karma full - every hour
    log("Scheduling: Karma Full Refresh (every hour)", "info");
    const fullTimer = scheduleTask("karmaFull", refreshAllKarma, INTERVALS.KARMA_FULL);
    if (fullTimer) timers.push(fullTimer);

    // Review queue expire - every 5 minutes
    log("Scheduling: Review Queue Expire (every 5 minutes)", "info");
    await expireReviewQueue(); // Run immediately
    const expireTimer = scheduleTask("reviewExpire", expireReviewQueue, INTERVALS.REVIEW_EXPIRE);
    if (expireTimer) timers.push(expireTimer);
  }

  if (!KARMA_ONLY) {
    // Rankings - every 24 hours
    log("Scheduling: Rankings Update (every 24 hours)", "info");
    await updateRankings(); // Run immediately
    const rankingsTimer = scheduleTask("rankings", updateRankings, INTERVALS.RANKINGS);
    if (rankingsTimer) timers.push(rankingsTimer);
  }

  log("", "info");
  log("All tasks scheduled!", "success");
  log("Press Ctrl+C to stop", "warning");
  log("", "info");

  // Print stats every hour
  setInterval(
    () => {
      printStats();
    },
    60 * 60 * 1000,
  );

  // Keep process alive
  process.stdin.resume();
}

// Setup graceful shutdown
setupGracefulShutdown();

// Run
main().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  log(`Unhandled error: ${errorMessage}`, "error");
  console.error(err);
  process.exit(1);
});
