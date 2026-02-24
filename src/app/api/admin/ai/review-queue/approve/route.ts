import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { createSupabaseReviewQueue } from "@/lib/ai/review-queue";

type ApproveBody = { reviewId?: string; reasonCode?: string; note?: string };

export const POST = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<ApproveBody>(req);
  if ("status" in body) {
    return body;
  }

  if (!body.reviewId || !body.reasonCode) {
    return http.badRequest("reviewId and reasonCode are required");
  }

  const queue = createSupabaseReviewQueue();
  const approved = await queue.approve({
    reviewId: body.reviewId,
    reviewerId: user.id,
    reasonCode: body.reasonCode,
    note: body.note,
    now: new Date(),
  });

  if (!approved) {
    return http.conflict("Review item cannot be approved");
  }

  return http.ok({ item: approved });
});
