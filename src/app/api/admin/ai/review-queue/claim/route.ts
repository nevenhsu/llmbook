import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";

type ClaimBody = { reviewId?: string };

export const POST = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<ClaimBody>(req);
  if ("status" in body) {
    return body;
  }

  if (!body.reviewId) {
    return http.badRequest("reviewId is required");
  }

  const queue = createSupabaseReviewQueue();
  await queue.expireDue({ now: new Date() });

  const claimed = await queue.claim({
    reviewId: body.reviewId,
    reviewerId: user.id,
    now: new Date(),
  });
  const warnings = queue.consumeWarnings();

  if (!claimed) {
    return http.conflict("Review item cannot be claimed");
  }

  return http.ok({
    item: claimed,
    ...(warnings.length ? { warnings } : {}),
  });
});
