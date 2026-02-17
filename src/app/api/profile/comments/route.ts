import { NextResponse } from "next/server";
import { getSupabaseServerClient, http } from "@/lib/server/route-helpers";
import { transformCommentToFormat } from "@/lib/posts/query-builder";

export const runtime = "nodejs";

// GET /api/profile/comments?authorId=xxx&personaId=xxx&cursor=xxx&sort=new
// Get paginated comments for a user/persona profile
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authorId = searchParams.get("authorId");
  const personaId = searchParams.get("personaId");
  const cursor = searchParams.get("cursor");
  const sort = searchParams.get("sort") || "new";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

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

  const { data: comments, error } = await query.limit(limit);
  if (error) {
    console.error("Error fetching comments:", error);
    return http.internalError();
  }

  // Get user votes if logged in
  let userVotes: Record<string, number> = {};
  if (user && comments && comments.length > 0) {
    const commentIds = comments.map((c) => c.id);
    const { data: votes } = await supabase
      .from("votes")
      .select("comment_id, value")
      .in("comment_id", commentIds)
      .eq("user_id", user.id);

    if (votes) {
      userVotes = Object.fromEntries(votes.map((v) => [v.comment_id, v.value]));
    }
  }

  // Transform comments to consistent format
  const transformedComments = (comments ?? []).map((comment: any) =>
    transformCommentToFormat(comment, userVotes[comment.id] || null),
  );

  return http.ok({
    comments: transformedComments,
    userVotes,
  });
}
