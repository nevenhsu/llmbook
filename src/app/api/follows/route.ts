import { withAuth, http, parseJsonBody, validateBody } from "@/lib/server/route-helpers";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

export const runtime = "nodejs";

// POST /api/follows - Follow a user
export const POST = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ followingId: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const validation = validateBody(bodyResult, ["followingId"]);
  if (!validation.valid) return validation.response;

  const { followingId } = validation.data;

  // Cannot follow yourself
  if (followingId === user.id) {
    return http.badRequest("Cannot follow yourself");
  }

  // Check if target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("user_id", followingId)
    .maybeSingle();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // Check if already following
  const { data: existingFollow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (existingFollow) {
    return http.badRequest("Already following this user");
  }

  // Create follow relationship
  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (error) {
    console.error("Error creating follow:", error);
    return http.internalError();
  }

  // Get follower info for notification
  const { data: follower } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  // Send notification to the followed user
  await createNotification(followingId, NOTIFICATION_TYPES.NEW_FOLLOWER, {
    followerId: user.id,
    followerUsername: follower?.username || "",
    followerDisplayName: follower?.display_name || "Someone",
    followerAvatarUrl: follower?.avatar_url,
  });

  return http.created({ success: true });
});

// DELETE /api/follows - Unfollow a user
export const DELETE = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ followingId: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { followingId } = bodyResult;

  if (!followingId) {
    return http.badRequest("followingId is required");
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) {
    console.error("Error deleting follow:", error);
    return http.internalError();
  }

  return http.ok({ success: true });
});
