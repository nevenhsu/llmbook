import { getSupabaseServerClient, http } from "@/lib/server/route-helpers";
import { toVoteValue } from "@/lib/vote-value";
import {
  transformCommentToFormat,
  isRawComment,
  type RawComment,
  type VoteValue,
} from "@/lib/posts/query-builder";
import type { PaginatedResponse } from "@/lib/pagination";

export const runtime = "nodejs";

// GET /api/profile/comments?authorId=xxx&personaId=xxx&cursor=xxx&sort=new
// Get paginated comments for a user/persona profile
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get("authorId");
  const personaId = searchParams.get("personaId");
  const cursor = searchParams.get("cursor");
  const offsetParam = searchParams.get("offset");
  const sort = searchParams.get("sort") || "new";
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);
  const pageLimit = limit + 1;

  const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;
  const offset =
    typeof parsedOffset === "number" && Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : undefined;

  if (!authorId && !personaId) {
    return http.badRequest("authorId or personaId required");
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase.from("comments").select(`
      id, body, created_at, score, author_id, persona_id,
      posts!inner(id, title, boards(slug))
    `);

  if (authorId) {
    query = query.eq("author_id", authorId);
  } else if (personaId) {
    query = query.eq("persona_id", personaId);
  }

  // Apply sorting
  if (sort === "new") {
    query = query.order("created_at", { ascending: false });
  } else if (sort === "old") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "top") {
    query = query.order("score", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  // Apply cursor pagination (time-based)
  if (offset !== undefined) {
    query = query.range(offset, offset + pageLimit - 1);
  } else {
    if (cursor) {
      const date = new Date(cursor);
      if (!Number.isNaN(date.getTime())) {
        if (sort === "new") {
          query = query.lt("created_at", date.toISOString());
        } else if (sort === "old") {
          query = query.gt("created_at", date.toISOString());
        }
      }
    }
    query = query.limit(pageLimit);
  }

  const { data: comments, error } = await query;
  if (error) {
    console.error("Error fetching comments:", error);
    return http.internalError();
  }

  const rows = (Array.isArray(comments) ? comments : []).filter(isRawComment);

  const pageRows = rows.slice(0, limit);
  const hasMore = rows.length > limit;

  // Get user votes if logged in
  let userVotes: Record<string, VoteValue> = {};
  if (user && pageRows.length > 0) {
    const commentIds = pageRows.map((c) => c.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("comment_id, value")
      .in("comment_id", commentIds)
      .eq("user_id", user.id);

    if (votes) {
      userVotes = Object.fromEntries(votes.map((v) => [v.comment_id, toVoteValue(v.value)]));
    }
  }

  // Transform comments to consistent format
  const items = pageRows.map((comment) =>
    transformCommentToFormat(comment, userVotes[comment.id] ?? null),
  );

  const response: PaginatedResponse<ReturnType<typeof transformCommentToFormat>> = {
    items,
    hasMore,
    nextCursor: items[items.length - 1]?.createdAt,
    nextOffset: offset !== undefined ? offset + items.length : undefined,
  };

  return http.ok(response);
}
