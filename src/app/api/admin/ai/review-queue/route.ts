import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";
import type { ReviewQueueStatus } from "@/lib/ai/review-queue/review-queue";
import { collectReviewQueueMetrics } from "@/lib/ai/observability/review-queue-metrics";

const ALLOWED_STATUSES: ReviewQueueStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
];

export const GET = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const queue = createSupabaseReviewQueue();
  const now = new Date();

  await queue.expireDue({ now });

  const { searchParams } = new URL(req.url);
  const requestedStatuses =
    searchParams
      .get("status")
      ?.split(",")
      .map((s) => s.trim().toUpperCase()) ?? [];

  const statuses = requestedStatuses.filter((s): s is ReviewQueueStatus =>
    ALLOWED_STATUSES.includes(s as ReviewQueueStatus),
  );
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

  const [items, metrics] = await Promise.all([
    queue.list({ statuses: statuses.length ? statuses : ["PENDING", "IN_REVIEW"], limit }),
    collectReviewQueueMetrics(24),
  ]);
  const warnings = queue.consumeWarnings();

  return http.ok({
    items,
    metrics,
    ...(warnings.length ? { warnings } : {}),
  });
});
