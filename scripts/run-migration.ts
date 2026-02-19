#!/usr/bin/env ts-node
/**
 * Run database migration
 * Usage: ts-node -r tsconfig-paths/register scripts/run-migration.ts <migration-file>
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Error: Missing Supabase credentials in .env file");
  process.exit(1);
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error(
    "Usage: ts-node -r tsconfig-paths/register scripts/run-migration.ts <migration-file>",
  );
  process.exit(1);
}

async function runMigration() {
  console.log(`Running migration: ${migrationFile}`);

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read migration file
  const migrationPath = resolve(process.cwd(), "supabase", "migrations", migrationFile);
  console.log(`Reading migration from: ${migrationPath}`);

  const sql = readFileSync(migrationPath, "utf-8");

  console.log("Executing migration...");

  // Execute migration using rpc to run raw SQL
  // Note: This requires a custom RPC function in Supabase
  // Alternative: Use Supabase Management API or run manually

  console.log("\n⚠️  Direct SQL execution requires Supabase service role access.");
  console.log("Please run this migration manually using one of these methods:");
  console.log("1. Supabase Dashboard > SQL Editor");
  console.log("2. psql command line");
  console.log("3. Supabase CLI: supabase db push");
  console.log("\nMigration SQL:");
  console.log("─".repeat(80));
  console.log(sql);
  console.log("─".repeat(80));
}

runMigration().catch(console.error);
