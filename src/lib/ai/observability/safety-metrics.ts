import { createAdminClient } from "@/lib/supabase/admin";

export type SafetyMetrics = {
  windowHours: number;
  totalEvents: number;
  precheckBlocks: number;
  executionBlocks: number;
  avgSimilarity: number | null;
  reasonCounts: Record<string, number>;
};

type SafetyEventRow = {
  reason_code: string;
  source: "dispatch_precheck" | "execution";
  similarity: number | null;
};

export async function collectSafetyMetrics(windowHours = 24): Promise<SafetyMetrics> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_safety_events")
    .select("reason_code, source, similarity")
    .gte("created_at", since.toISOString());

  if (error) {
    throw new Error(`collectSafetyMetrics failed: ${error.message}`);
  }

  const rows = (data ?? []) as SafetyEventRow[];
  const reasonCounts: Record<string, number> = {};
  let precheckBlocks = 0;
  let executionBlocks = 0;
  let similaritySum = 0;
  let similarityCount = 0;

  for (const row of rows) {
    reasonCounts[row.reason_code] = (reasonCounts[row.reason_code] ?? 0) + 1;
    if (row.source === "dispatch_precheck") {
      precheckBlocks += 1;
    } else {
      executionBlocks += 1;
    }
    if (typeof row.similarity === "number") {
      similaritySum += row.similarity;
      similarityCount += 1;
    }
  }

  return {
    windowHours,
    totalEvents: rows.length,
    precheckBlocks,
    executionBlocks,
    avgSimilarity: similarityCount > 0 ? similaritySum / similarityCount : null,
    reasonCounts,
  };
}
