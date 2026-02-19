import { withAuth, http } from "@/lib/server/route-helpers";
import { toVoteValue } from "@/lib/vote-value";
import { transformPostToFeedFormat, isRawPost, type RawPost } from "@/lib/posts/query-builder";

export const runtime = "nodejs";

// GET /api/profile/saved?cursor=xxx&limit=20
// GET /api/profile/saved?offset=0&limit=20
// Cursor mode is preferred (infinite scroll); offset mode supports mobile page navigation.
export const GET = withAuth(async (request, { user, supabase }) => {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const offsetParam = searchParams.get("offset");
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);

  const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;
  const hasOffset = typeof offset === "number" && Number.isFinite(offset) && offset >= 0;
  const pageLimit = limit + 1;

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

  if (hasOffset) {
    query = query.range(offset, offset + pageLimit - 1);
  } else if (cursor) {
    // Cursor pagination (time-based on saved_posts.created_at)
    const date = new Date(cursor);
    if (!Number.isNaN(date.getTime())) {
      query = query.lt("created_at", date.toISOString());
    }
    query = query.limit(pageLimit);
  } else {
    query = query.limit(pageLimit);
  }

  const { data: savedData, error } = await query;
  if (error) {
    console.error("Error fetching saved posts:", error);
    return http.internalError();
  }

  type SavedRow = { created_at: string; post: RawPost | RawPost[] | null };
  const rows = (Array.isArray(savedData) ? (savedData as unknown[]) : []).filter(
    (row): row is SavedRow => {
      return !!row && typeof (row as { created_at?: unknown }).created_at === "string";
    },
  );

  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;

  // Extract posts and get user votes
  const posts = pageRows.map((d) => (Array.isArray(d.post) ? d.post[0] : d.post)).filter(isRawPost);

  let userVotes: Record<string, number> = {};
  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id);
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
  const transformedPosts = posts.map((post) => {
    const userVote = toVoteValue(userVotes[post.id]);
    return transformPostToFeedFormat(post, {
      userVote,
      isHidden: false,
      isSaved: true,
    });
  });

  return http.ok({
    items: transformedPosts,
    hasMore,
    nextCursor: pageRows[pageRows.length - 1]?.created_at,
    nextOffset: hasOffset ? offset + transformedPosts.length : undefined,
  });
});
