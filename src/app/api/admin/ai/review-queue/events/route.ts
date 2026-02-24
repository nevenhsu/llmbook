import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";

export const GET = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const reviewId = searchParams.get("reviewId") ?? undefined;
  const limitRaw = Number(searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;

  const queue = createSupabaseReviewQueue();
  const events = await queue.listEvents({ reviewId, limit });

  return http.ok({ events });
});
