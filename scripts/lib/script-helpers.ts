/**
 * Shared utilities for background scripts
 */

import { privateEnv, publicEnv } from "../../src/lib/env";
import { createAdminClient } from "../../src/lib/supabase/admin";

export type LogType = "info" | "success" | "error" | "warning" | "wait";

export function getTimestamp(): string {
  return new Date().toISOString();
}

export function log(message: string, type: LogType = "info"): void {
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

export function logSeparator(): void {
  log("=".repeat(60), "info");
}

export async function validateEnvironment(): Promise<void> {
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
}

export async function testDatabaseConnection(tableName: string = "profiles"): Promise<void> {
  log("Testing database connection...", "info");
  try {
    const supabase = createAdminClient();
    const { error: testError } = await supabase
      .from(tableName)
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
}

export async function wait(ms: number): Promise<void> {
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  let waitMessage: string;
  let intervalMs: number;

  if (days >= 1) {
    waitMessage = `${days} day${days > 1 ? "s" : ""}`;
    intervalMs = 60 * 60 * 1000; // 1 hour
  } else if (hours >= 1) {
    waitMessage = `${hours} hour${hours > 1 ? "s" : ""}`;
    intervalMs = 60 * 60 * 1000; // 1 hour
  } else {
    waitMessage = `${minutes} minute${minutes > 1 ? "s" : ""}`;
    intervalMs = minutes < 10 ? 60 * 1000 : 60 * 60 * 1000; // 1 min or 1 hour
  }

  log(`Waiting ${waitMessage} before next update...`, "wait");

  return new Promise<void>((resolve) => {
    let remainingMs = ms;

    const interval = setInterval(() => {
      remainingMs -= intervalMs;
      if (remainingMs > 0) {
        if (days >= 1) {
          const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
          log(`${remainingDays} day${remainingDays > 1 ? "s" : ""} remaining...`, "wait");
        } else if (hours >= 1) {
          const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
          log(`${remainingHours} hour${remainingHours > 1 ? "s" : ""} remaining...`, "wait");
        } else {
          const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
          log(`${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""} remaining...`, "wait");
        }
      }
    }, intervalMs);

    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, ms);
  });
}

export function setupGracefulShutdown(): void {
  process.on("SIGINT", () => {
    log("\n\nReceived SIGINT (Ctrl+C), shutting down gracefully...", "warning");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    log("\n\nReceived SIGTERM, shutting down gracefully...", "warning");
    process.exit(0);
  });
}

export interface ScriptOptions {
  scriptName: string;
  runOnce: boolean;
  updateInterval?: string;
}

export async function runScript(
  options: ScriptOptions,
  updateFunction: () => Promise<boolean>,
  waitTimeMs: number,
): Promise<void> {
  const { scriptName, runOnce, updateInterval } = options;

  logSeparator();
  log(scriptName, "info");
  logSeparator();

  // Validate environment
  await validateEnvironment();

  // Test connection
  await testDatabaseConnection();

  log("", "info");

  if (runOnce) {
    log("Running in ONCE mode (no repeat)", "warning");
    const success = await updateFunction();
    process.exit(success ? 0 : 1);
  }

  // Main loop
  log(`Starting continuous update loop (updates every ${updateInterval || "interval"})`, "info");
  log("Press Ctrl+C to stop", "warning");
  log("", "info");

  let iteration = 0;

  while (true) {
    iteration++;
    log(`\n${"=".repeat(60)}`, "info");
    log(`Update iteration #${iteration}`, "info");
    log(`${"=".repeat(60)}`, "info");

    await updateFunction();

    // Wait for next iteration
    await wait(waitTimeMs);
  }
}
