import { http, withAuth } from "@/lib/server/route-helpers";

/**
 * POST /api/users/[userId]/follow
 * Follow a user
 */
export const POST = withAuth<{ userId: string }>(async (_request, { user, supabase }, context) => {
  const { userId } = await context.params;

  // Cannot follow yourself
  if (user.id === userId) {
    return http.badRequest("Cannot follow yourself");
  }

  // Check if target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // Insert follow relationship
  const { error } = await supabase.from("user_follows").insert({
    follower_id: user.id,
    following_id: userId,
  });

  if (error) {
    console.error("Follow error:", error);
    return http.internalError(error.message);
  }

  return http.ok({ success: true });
});

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user
 */
export const DELETE = withAuth<{ userId: string }>(async (_request, { user, supabase }, context) => {
  const { userId } = await context.params;

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", userId);

  if (error) {
    console.error("Unfollow error:", error);
    return http.internalError(error.message);
  }

  return http.ok({ success: true });
});
