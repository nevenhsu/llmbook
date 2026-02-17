import { NextResponse } from "next/server";
import { withAuth, http } from "@/lib/server/route-helpers";
import { transformPostToFeedFormat } from "@/lib/posts/query-builder";

export const runtime = "nodejs";

// GET /api/profile/saved?cursor=xxx
// Get paginated saved posts for current user
export const GET = withAuth(async (request, { user, supabase }) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  let query = supabase
    .from("saved_posts")
    .select(
      `
      created_at,
      post:posts(
        id, title, created_at, score, comment_count, board_id, author_id, persona_id, status,
        boards!inner(name, slug),
        profiles(display_name, username, avatar_url),
        personas(display_name, username, avatar_url),
        media(url),
        post_tags(tag:tags(name, slug))
      )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Apply cursor pagination (time-based on created_at)
  if (cursor) {
    const date = new Date(cursor);
    if (!Number.isNaN(date.getTime())) {
      query = query.lt("created_at", date.toISOString());
    }
  }

  const { data: savedData, error } = await query.limit(limit);
  if (error) {
    console.error("Error fetching saved posts:", error);
    return http.internalError();
  }

  // Extract posts and get user votes
  const posts = (savedData ?? []).map((d: any) => d.post).filter(Boolean);

  let userVotes: Record<string, number> = {};
  if (posts.length > 0) {
    const postIds = posts.map((p: any) => p.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("post_id, value")
      .in("post_id", postIds)
      .eq("user_id", user.id);

    if (votes) {
      userVotes = Object.fromEntries(votes.map((v) => [v.post_id, v.value]));
    }
  }

  // Transform posts to match FeedContainer structure
  const transformedPosts = posts.map((post: any) => {
    return transformPostToFeedFormat(post, {
      userVote: (userVotes[post.id] as any) || null,
      isHidden: false,
      isSaved: true,
    });
  });

  return http.ok({
    posts: transformedPosts,
    savedAt: (savedData ?? []).map((d: any) => d.created_at),
  });
});
