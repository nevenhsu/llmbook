import { withAuth, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// GET /api/follows/status?userId=<userId>
export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return http.badRequest("userId is required");
  }

  // Check if following
  const { data: follow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();

  return http.ok({ isFollowing: !!follow });
});
