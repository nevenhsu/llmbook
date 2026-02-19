import { withAuth, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// GET /api/mentions/validate?username=<username>
export const GET = withAuth(async (req, { supabase }) => {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return http.badRequest("username is required");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .ilike("username", username)
    .maybeSingle();

  if (error) {
    console.error("Error validating username:", error);
    return http.internalError();
  }

  if (!data) {
    return http.ok({ valid: false, user: null });
  }

  return http.ok({
    valid: true,
    user: {
      id: data.user_id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
    },
  });
});
