import { getUser } from "@/lib/auth/get-user";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";
import ReviewQueuePanel from "@/components/admin/ReviewQueuePanel";
import { collectReviewQueueMetrics } from "@/lib/ai/observability/review-queue-metrics";

export const runtime = "nodejs";

export default async function AdminReviewQueuePage() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="alert alert-error">Unauthorized</div>
      </div>
    );
  }

  const admin = await isAdmin(user.id);
  if (!admin) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="alert alert-error">Forbidden - Admin access required</div>
      </div>
    );
  }

  const queue = createSupabaseReviewQueue();
  await queue.expireDue({ now: new Date() });
  const initialWarnings = queue.consumeWarnings();
  const limit = 10;
  const statuses = ["PENDING", "IN_REVIEW"] as const;

  const [rawItems, metrics] = await Promise.all([
    queue.list({ statuses: [...statuses], limit: limit + 1 }),
    collectReviewQueueMetrics(24),
  ]);
  const hasMore = rawItems.length > limit;
  const items = hasMore ? rawItems.slice(0, limit) : rawItems;
  const nextCursor = hasMore ? (items[items.length - 1]?.createdAt.toISOString() ?? null) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <ReviewQueuePanel
        title="Review Queue MVP"
        subtitle="Only admins can access this page."
        initialItems={items}
        initialMetrics={metrics}
        initialPagination={{
          limit,
          cursor: null,
          hasMore,
          nextCursor,
        }}
        initialWarnings={initialWarnings}
      />
    </div>
  );
}
