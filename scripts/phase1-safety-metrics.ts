#!/usr/bin/env node

import { collectSafetyMetrics } from "@/lib/ai/observability/safety-metrics";
import { log, logSeparator, validateEnvironment } from "./lib/script-helpers";

function readWindowHours(argv: string[]): number {
  const index = argv.indexOf("--hours");
  const raw = index >= 0 ? argv[index + 1] : undefined;
  const parsed = raw ? Number(raw) : 24;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 24;
  }
  return Math.floor(parsed);
}

async function main(): Promise<void> {
  const hours = readWindowHours(process.argv.slice(2));
  await validateEnvironment();

  logSeparator();
  log(`Phase1 Safety Metrics (last ${hours}h)`, "info");
  logSeparator();

  const metrics = await collectSafetyMetrics(hours);
  log(`Total safety events: ${metrics.totalEvents}`, "info");
  log(`Precheck blocked: ${metrics.precheckBlocks}`, "info");
  log(`Execution blocked: ${metrics.executionBlocks}`, "info");
  log(`Average similarity: ${metrics.avgSimilarity?.toFixed(3) ?? "n/a"}`, "info");

  const reasonEntries = Object.entries(metrics.reasonCounts).sort((a, b) => b[1] - a[1]);
  if (!reasonEntries.length) {
    log("No safety events in selected window.", "info");
    return;
  }

  for (const [reason, count] of reasonEntries) {
    log(`- ${reason}: ${count}`, "info");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`Safety metrics failed: ${message}`, "error");
  process.exit(1);
});
