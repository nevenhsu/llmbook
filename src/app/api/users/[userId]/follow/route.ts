import { http, withAuth } from "@/lib/server/route-helpers";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

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
    .select("user_id, username, display_name, avatar_url")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // Check if already following
  const { data: existingFollow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();

  if (existingFollow) {
    return http.badRequest("Already following this user");
  }

  // Insert follow relationship
  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: userId,
  });

  if (error) {
    console.error("Follow error:", error);
    return http.internalError(error.message);
  }

  // Get follower info for notification
  const { data: follower } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  // Send notification to the followed user
  await createNotification(userId, NOTIFICATION_TYPES.NEW_FOLLOWER, {
    followerId: user.id,
    followerUsername: follower?.username || "",
    followerDisplayName: follower?.display_name || "Someone",
    followerAvatarUrl: follower?.avatar_url,
  });

  return http.ok({ success: true });
});

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user
 */
export const DELETE = withAuth<{ userId: string }>(
  async (_request, { user, supabase }, context) => {
    const { userId } = await context.params;

    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", userId);

    if (error) {
      console.error("Unfollow error:", error);
      return http.internalError(error.message);
    }

    return http.ok({ success: true });
  },
);
