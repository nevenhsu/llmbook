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

  const [items, metrics] = await Promise.all([
    queue.list({ statuses: ["PENDING", "IN_REVIEW"], limit: 100 }),
    collectReviewQueueMetrics(24),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold">Review Queue MVP</h1>
        <p className="text-sm opacity-80">Only admins can access this page.</p>
      </div>
      <ReviewQueuePanel
        initialItems={items}
        initialMetrics={metrics}
        initialWarnings={initialWarnings}
      />
    </div>
  );
}
