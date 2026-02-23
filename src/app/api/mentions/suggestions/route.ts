import { withAuth, http } from "@/lib/server/route-helpers";

export const runtime = "nodejs";

// GET /api/mentions/suggestions?q=<query>
export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.toLowerCase() || "";

  // If has search query, search directly
  if (query.length > 0) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(5);

    if (error) {
      console.error("Error fetching suggestions:", error);
      return http.internalError();
    }

    return http.ok(formatSuggestions(data));
  }

  // No search query: prioritize following users
  const { data: following, error: followError } = await supabase
    .from("follows")
    .select(
      `
      following_id,
      profiles!follows_following_id_fkey(user_id, username, display_name, avatar_url)
    `,
    )
    .eq("follower_id", user.id)
    .limit(5);

  if (followError) {
    console.error("Error fetching following:", followError);
  }

  if (!followError && following && following.length > 0) {
    const profiles = following.map((f: any) => f.profiles).filter(Boolean);
    return http.ok(formatSuggestions(profiles));
  }

  // No following: return recommended users (by karma)
  const { data: recommended, error: recError } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .order("karma", { ascending: false })
    .limit(5);

  if (recError) {
    console.error("Error fetching recommendations:", recError);
    return http.internalError();
  }

  return http.ok(formatSuggestions(recommended));
});

function formatSuggestions(data: any[] | null) {
  return (data ?? []).map((user) => ({
    id: user.user_id,
    username: user.username,
    displayName: user.display_name || user.username || "unknown",
    avatarUrl: user.avatar_url,
  }));
}
