import { getSupabaseServerClient, http } from "@/lib/server/route-helpers";
import type { PaginatedResponse } from "@/lib/pagination";

export const runtime = "nodejs";

export interface UserListItem {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  karma: number;
  followedAt: string;
  isFollowing?: boolean; // Whether current user follows this user
}

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);
  const pageLimit = limit + 1;

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Verify target user exists
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // Build query for following
  let query = supabase
    .from("follows")
    .select(
      `
      following_id,
      created_at,
      profiles!follows_following_id_fkey(user_id, username, display_name, avatar_url, karma)
    `
    )
    .eq("follower_id", userId)
    .order("created_at", { ascending: false })
    .limit(pageLimit);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data: follows, error } = await query;

  if (error) {
    console.error("Error fetching following:", error);
    return http.internalError();
  }

  if (!follows || follows.length === 0) {
    const empty: PaginatedResponse<UserListItem> = { items: [], hasMore: false };
    return http.ok(empty);
  }

  // Transform to UserListItem format
  const users = follows
    .map((follow) => {
      const profile = follow.profiles as unknown as {
        user_id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        karma: number;
      } | null;

      if (!profile) return null;

      return {
        userId: profile.user_id,
        username: profile.username,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        karma: profile.karma,
        followedAt: follow.created_at,
      };
    })
    .filter((item): item is UserListItem => item !== null);

  const pageUsers = users.slice(0, limit);
  const hasMore = users.length > limit;

  // If logged in, check which users the current user follows
  if (user && pageUsers.length > 0) {
    const followingIds = pageUsers.map((u) => u.userId);
    const { data: followingData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .in("following_id", followingIds);

    const followingSet = new Set(followingData?.map((f) => f.following_id) || []);

    pageUsers.forEach((user) => {
      user.isFollowing = followingSet.has(user.userId);
    });
  }

  const response: PaginatedResponse<UserListItem> = {
    items: pageUsers,
    hasMore,
    nextCursor: hasMore ? pageUsers[pageUsers.length - 1].followedAt : undefined,
  };

  return http.ok(response);
}
