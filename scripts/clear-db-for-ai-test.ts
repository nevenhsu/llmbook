/**
 * Clear database for AI generation testing
 *
 * This script clears all data except:
 * - profiles
 * - personas
 * - boards
 *
 * Usage: npx tsx scripts/clear-db-for-ai-test.ts
 */

import { createClient } from "@supabase/supabase-js";
import { publicEnv, privateEnv } from "@/lib/env";

const supabase = createClient(publicEnv.supabaseUrl, privateEnv.supabaseServiceRoleKey);

const TABLES_TO_CLEAR = [
  "post_rankings",
  "persona_llm_usage",
  "persona_memory",
  "persona_tasks",
  "notifications",
  "media",
  "hidden_posts",
  "saved_posts",
  "post_tags",
  "comments",
  "poll_votes",
  "poll_options",
  "votes",
  "posts",
  "tags",
];

const TABLES_TO_SKIP = [
  "profiles",
  "personas",
  "boards",
  "follows",
  "admin_users",
  "board_moderators",
  "board_members",
  "persona_engine_config",
  "persona_souls",
  "persona_long_memories",
];

const TABLES_NO_ID = ["saved_posts", "post_tags"];

function log(message: string, type: "info" | "success" | "error" | "warning" = "info"): void {
  const prefix =
    {
      info: "ℹ️ ",
      success: "✅",
      error: "❌",
      warning: "⚠️ ",
    }[type] || "ℹ️ ";

  console.log(`${prefix} ${message}`);
}

function logSeparator(): void {
  log("=".repeat(60));
}

async function clearTable(tableName: string): Promise<number> {
  const { count, error } = await supabase
    .from(tableName)
    .select("*", { count: "exact", head: true });

  if (error) {
    log(`  Error getting count: ${error.message}`, "error");
    return 0;
  }

  if (!count || count === 0) {
    log(`  No records to delete`, "info");
    return 0;
  }

  let deleteError;

  if (TABLES_NO_ID.includes(tableName)) {
    const { error: err } = await supabase
      .from(tableName)
      .delete()
      .neq("post_id", "00000000-0000-0000-0000-000000000000");
    deleteError = err;
  } else {
    const { error: err } = await supabase
      .from(tableName)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    deleteError = err;
  }

  if (deleteError) {
    log(`  Error deleting: ${deleteError.message}`, "error");
    return 0;
  }

  return count;
}

async function main() {
  logSeparator();
  log("Clear Database for AI Testing");
  logSeparator();

  log("\nTables that will be SKIPPED (preserved):", "warning");
  TABLES_TO_SKIP.forEach((table) => log(`  - ${table}`, "info"));

  log("\nTables that will be CLEARED:", "warning");
  TABLES_TO_CLEAR.forEach((table) => log(`  - ${table}`, "info"));

  logSeparator();

  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => rl.question(prompt, resolve));
  };

  const answer = await question("\nAre you sure you want to delete all data? (y/n): ");
  rl.close();

  if (answer.toLowerCase() !== "y") {
    log("Cancelled.", "info");
    process.exit(0);
  }

  let totalDeleted = 0;

  for (const table of TABLES_TO_CLEAR) {
    log(`\nClearing table: ${table}`, "info");
    const deleted = await clearTable(table);
    if (deleted > 0) {
      log(`  Deleted ${deleted} records`, "success");
      totalDeleted += deleted;
    } else {
      log(`  Done`, "success");
    }
  }

  logSeparator();
  log(`Total records deleted: ${totalDeleted}`, "success");
  log("\nDatabase cleared successfully!", "success");
}

main().catch((err) => {
  log(`Script failed: ${err}`, "error");
  process.exit(1);
});
