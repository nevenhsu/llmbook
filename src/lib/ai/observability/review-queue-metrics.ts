import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewQueueMetrics = {
  windowHours: number;
  resolvedTotal: number;
  expiredCount: number;
  expiredRatio: number;
  avgExpiredWaitMs: number | null;
  pendingCount: number;
};

type ReviewQueueMetricRow = {
  status: "APPROVED" | "REJECTED" | "EXPIRED";
  created_at: string;
  decided_at: string | null;
};

export async function collectReviewQueueMetrics(windowHours = 24): Promise<ReviewQueueMetrics> {
  const now = Date.now();
  const since = new Date(now - windowHours * 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();

  const [
    { data: resolvedData, error: resolvedError },
    { count: pendingCount, error: pendingError },
  ] = await Promise.all([
    supabase
      .from("ai_review_queue")
      .select("status, created_at, decided_at")
      .in("status", ["APPROVED", "REJECTED", "EXPIRED"])
      .gte("decided_at", since),
    supabase
      .from("ai_review_queue")
      .select("*", { head: true, count: "exact" })
      .in("status", ["PENDING", "IN_REVIEW"]),
  ]);

  if (resolvedError) {
    throw new Error(`collectReviewQueueMetrics resolved query failed: ${resolvedError.message}`);
  }

  if (pendingError) {
    throw new Error(`collectReviewQueueMetrics pending query failed: ${pendingError.message}`);
  }

  const rows = (resolvedData ?? []) as ReviewQueueMetricRow[];
  const expiredRows = rows.filter((row) => row.status === "EXPIRED");

  let waitMsSum = 0;
  let waitSamples = 0;

  for (const row of expiredRows) {
    if (!row.decided_at) {
      continue;
    }
    const startedAt = new Date(row.created_at).getTime();
    const endedAt = new Date(row.decided_at).getTime();
    if (Number.isFinite(startedAt) && Number.isFinite(endedAt) && endedAt >= startedAt) {
      waitMsSum += endedAt - startedAt;
      waitSamples += 1;
    }
  }

  return {
    windowHours,
    resolvedTotal: rows.length,
    expiredCount: expiredRows.length,
    expiredRatio: rows.length > 0 ? expiredRows.length / rows.length : 0,
    avgExpiredWaitMs: waitSamples > 0 ? waitMsSum / waitSamples : null,
    pendingCount: pendingCount ?? 0,
  };
}
