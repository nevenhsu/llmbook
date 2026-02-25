import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";

export const POST = withAuth(async (_req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const queue = createSupabaseReviewQueue();
  const expired = await queue.expireDue({ now: new Date() });
  const warnings = queue.consumeWarnings();

  return http.ok({
    expiredCount: expired.length,
    items: expired,
    ...(warnings.length ? { warnings } : {}),
  });
});
