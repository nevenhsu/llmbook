#!/usr/bin/env node
/**
 * Local Ranking Update Script
 *
 * Usage:
 *   npm run update-rankings
 *   npm run update-rankings:once    # 只執行一次，不重複
 *
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * This script:
 *   1. Calculates Hot rankings (30 days)
 *   2. Calculates Rising rankings (7 days)
 *   3. Waits 1 day
 *   4. Repeats
 */

import { privateEnv, publicEnv } from "../src/lib/env";
import { createAdminClient } from "../src/lib/supabase/admin";

// Check if running in "once" mode (no repeat)
const RUN_ONCE = process.argv.includes("--once") || process.argv.includes("-o");

// Wait time between updates (1 day in milliseconds)
const WAIT_TIME_MS = 24 * 60 * 60 * 1000;

type LogType = "info" | "success" | "error" | "warning" | "wait";

function getTimestamp(): string {
  return new Date().toISOString();
}

function log(message: string, type: LogType = "info"): void {
  const timestamp = getTimestamp();
  const prefix =
    {
      info: "ℹ️ ",
      success: "✅",
      error: "❌",
      warning: "⚠️ ",
      wait: "⏳",
    }[type] || "ℹ️ ";

  console.log(`${prefix} [${timestamp}] ${message}`);
}

async function updateRankings(): Promise<boolean> {
  try {
    log("Starting ranking update...", "info");
    log("Step 1/2: Calculating Hot rankings (30 days)...", "info");
    log("Step 2/2: Calculating Rising rankings (7 days)...", "info");

    const startTime = Date.now();

    // Create admin client using shared library
    const supabase = createAdminClient();

    // Call the database function to update rankings
    const { error } = await supabase.rpc("fn_update_post_rankings");

    if (error) {
      log(`Failed to update rankings: ${error.message}`, "error");
      return false;
    }

    const duration = Date.now() - startTime;

    // Get stats after update
    const { data: stats, error: statsError } = await supabase
      .from("post_rankings")
      .select("hot_rank, rising_rank, calculated_at")
      .order("hot_rank", { ascending: true })
      .limit(1)
      .single();

    if (statsError) {
      log(`Rankings updated but failed to get stats: ${statsError.message}`, "warning");
    } else {
      const { count: hotCount, error: hotError } = await supabase
        .from("post_rankings")
        .select("*", { count: "exact", head: true })
        .gt("hot_rank", 0);

      const { count: risingCount, error: risingError } = await supabase
        .from("post_rankings")
        .select("*", { count: "exact", head: true })
        .gt("rising_rank", 0);

      log(`Rankings updated successfully in ${duration}ms`, "success");
      log(`  - Hot posts: ${hotError ? "N/A" : hotCount}`, "info");
      log(`  - Rising posts: ${risingError ? "N/A" : risingCount}`, "info");
      log(`  - Calculated at: ${stats.calculated_at}`, "info");
    }

    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Error updating rankings: ${errorMessage}`, "error");
    console.error(err);
    return false;
  }
}

async function wait(ms: number): Promise<void> {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  log(`Waiting ${hours} hours before next update...`, "wait");

  return new Promise<void>((resolve) => {
    // Show progress every hour
    const intervalMs = 60 * 60 * 1000; // 1 hour
    let remainingMs = ms;

    const interval = setInterval(() => {
      remainingMs -= intervalMs;
      if (remainingMs > 0) {
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        log(`${remainingHours} hours remaining...`, "wait");
      }
    }, intervalMs);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, ms);
  });
}

async function main(): Promise<void> {
  log("=".repeat(60), "info");
  log("Post Rankings Update Script", "info");
  log("=".repeat(60), "info");

  // Validate environment using shared lib
  try {
    // Accessing privateEnv will throw if required vars are missing
    const _ = privateEnv.supabaseServiceRoleKey;
    log(`Supabase URL: ${publicEnv.supabaseUrl}`, "info");
    log(`Service Role Key: ${privateEnv.supabaseServiceRoleKey.substring(0, 10)}...`, "info");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Environment validation failed: ${errorMessage}`, "error");
    log("Please check your .env.local file", "info");
    process.exit(1);
  }

  // Test connection
  log("Testing database connection...", "info");
  try {
    const supabase = createAdminClient();
    const { error: testError } = await supabase
      .from("post_rankings")
      .select("id", { count: "exact", head: true });

    if (testError) {
      log(`Failed to connect to database: ${testError.message}`, "error");
      process.exit(1);
    }

    log("Database connection successful!", "success");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log(`Failed to connect to database: ${errorMessage}`, "error");
    process.exit(1);
  }

  log("", "info");

  if (RUN_ONCE) {
    log("Running in ONCE mode (no repeat)", "warning");
    const success = await updateRankings();
    process.exit(success ? 0 : 1);
  }

  // Main loop
  log("Starting continuous update loop (updates every 24 hours)", "info");
  log("Press Ctrl+C to stop", "warning");
  log("", "info");

  let iteration = 0;

  while (true) {
    iteration++;
    log(`\n${"=".repeat(60)}`, "info");
    log(`Update iteration #${iteration}`, "info");
    log(`${"=".repeat(60)}`, "info");

    await updateRankings();

    // Wait for next iteration
    await wait(WAIT_TIME_MS);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  log("\n\nReceived SIGINT (Ctrl+C), shutting down gracefully...", "warning");
  process.exit(0);
});

process.on("SIGTERM", () => {
  log("\n\nReceived SIGTERM, shutting down gracefully...", "warning");
  process.exit(0);
});

// Run main
main().catch((err: unknown) => {
  const errorMessage = err instanceof Error ? err.message : String(err);
  log(`Unhandled error: ${errorMessage}`, "error");
  console.error(err);
  process.exit(1);
});
