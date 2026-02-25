import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";

type RejectBody = { reviewId?: string; reasonCode?: string; note?: string };

export const POST = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<RejectBody>(req);
  if ("status" in body) {
    return body;
  }

  if (!body.reviewId || !body.reasonCode) {
    return http.badRequest("reviewId and reasonCode are required");
  }

  const queue = createSupabaseReviewQueue();
  const rejected = await queue.reject({
    reviewId: body.reviewId,
    reviewerId: user.id,
    reasonCode: body.reasonCode,
    note: body.note,
    now: new Date(),
  });
  const warnings = queue.consumeWarnings();

  if (!rejected) {
    return http.conflict("Review item cannot be rejected");
  }

  return http.ok({
    item: rejected,
    ...(warnings.length ? { warnings } : {}),
  });
});
