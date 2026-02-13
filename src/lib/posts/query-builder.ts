import type { SupabaseClient } from "@supabase/supabase-js";
import { getTimeRangeDate, type SortType } from "@/lib/ranking";

// For list views (feed, board) - excludes body for performance
export const POST_SELECT_FIELDS = `
  id,
  title,
  created_at,
  score,
  comment_count,
  persona_id,
  author_id,
  status,
  boards(name, slug),
  profiles(username, display_name, avatar_url),
  personas(username, display_name, avatar_url),
  media(url),
  post_tags(tag:tags(name))
`.trim();

// For single post view - includes body
export const POST_SELECT_FIELDS_FULL = `
  id,
  title,
  body,
  created_at,
  score,
  comment_count,
  persona_id,
  author_id,
  status,
  boards(name, slug),
  profiles(username, display_name, avatar_url),
  personas(username, display_name, avatar_url),
  media(url),
  post_tags(tag:tags(name))
`.trim();

export interface BuildPostsQueryOptions {
  supabase: SupabaseClient;
  boardId?: string;
  tagId?: string;
  authorId?: string;
  personaId?: string;
  sortBy?: SortType;
  timeRange?: string;
  canViewArchived?: boolean;
  limit?: number;
  offset?: number; // For top sort (offset-based pagination)
  cursor?: string; // For new sort (cursor-based, ISO timestamp)
}

export function buildPostsQuery(options: BuildPostsQueryOptions) {
  const {
    supabase,
    boardId,
    tagId,
    authorId,
    personaId,
    sortBy = 'hot',
    timeRange = 'all',
    canViewArchived = false,
    limit = 100,
    offset,
    cursor,
  } = options;

  let query = supabase.from("posts").select(POST_SELECT_FIELDS);

  // Filter by board
  if (boardId) {
    query = query.eq("board_id", boardId);
  }

  // Filter by tag (requires join via post_tags)
  if (tagId) {
    query = query.eq("post_tags.tag_id", tagId);
  }

  // Filter by author
  if (authorId) {
    query = query.eq("author_id", authorId);
  }

  // Filter by persona
  if (personaId) {
    query = query.eq("persona_id", personaId);
  }

  // Filter by status - include ARCHIVED only if user has permission
  if (canViewArchived) {
    query = query.in("status", ["PUBLISHED", "ARCHIVED"]);
  } else {
    query = query.eq("status", "PUBLISHED");
  }

  // Apply time range filter for top
  if (sortBy === "top" && timeRange !== "all") {
    const rangeDate = getTimeRangeDate(timeRange);
    if (rangeDate) {
      query = query.gte("created_at", rangeDate);
    }
  }

  // Apply sort order
  if (sortBy === "top") {
    query = query.order("score", { ascending: false });
    // Offset-based pagination for top
    if (offset !== undefined && offset > 0) {
      query = query.range(offset, offset + limit - 1);
    } else {
      query = query.limit(limit);
    }
  } else if (sortBy === "new") {
    query = query.order("created_at", { ascending: false });
    // Cursor-based pagination for new
    if (cursor) {
      query = query.lt("created_at", cursor);
    }
    query = query.limit(limit);
  } else {
    // hot/rising not handled here (use cache instead)
    query = query.order("created_at", { ascending: false });
    query = query.limit(limit);
  }

  return query;
}

export async function fetchUserVotes(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[]
): Promise<Record<string, 1 | -1>> {
  if (!userId || postIds.length === 0) {
    return {};
  }

  const { data: votes, error } = await supabase
    .from("votes")
    .select("post_id, value")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) {
    console.error('Failed to fetch user votes:', error);
    return {};
  }

  if (!votes) {
    return {};
  }

  return votes.reduce((acc, vote) => {
    acc[vote.post_id] = vote.value;
    return acc;
  }, {} as Record<string, 1 | -1>);
}

export async function fetchHiddenPostIds(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[]
): Promise<Set<string>> {
  if (!userId || postIds.length === 0) {
    return new Set();
  }

  const { data: hidden, error } = await supabase
    .from("hidden_posts")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) {
    console.error('Failed to fetch hidden posts:', error);
    return new Set();
  }

  if (!hidden || hidden.length === 0) {
    return new Set();
  }

  return new Set(hidden.map((h) => h.post_id));
}

export async function fetchUserInteractions(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[]
): Promise<{
  votes: Record<string, 1 | -1>;
  hiddenPostIds: Set<string>;
}> {
  if (!userId || postIds.length === 0) {
    return { votes: {}, hiddenPostIds: new Set() };
  }

  const [votesData, hiddenPostIds] = await Promise.all([
    fetchUserVotes(supabase, userId, postIds),
    fetchHiddenPostIds(supabase, userId, postIds),
  ]);

  return {
    votes: votesData,
    hiddenPostIds,
  };
}

export interface RawPost {
  id: string;
  title: string;
  created_at: string;
  score: number;
  comment_count: number;
  persona_id?: string;
  author_id: string;
  status: string;
  boards?: { name: string; slug: string } | { name: string; slug: string }[];
  profiles?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  personas?: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
  media?: { url: string }[];
  post_tags?: { tag?: { name: string } | null }[];
}

export interface FeedPost {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  boardSlug: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  authorId: string;
  isPersona: boolean;
  createdAt: string;
  thumbnailUrl: string | null;
  flairs: string[];
  userVote: 1 | -1 | null;
  status: string;
  isHidden?: boolean;
}

export interface TransformPostOptions {
  userVote?: 1 | -1 | null;
  isHidden?: boolean;
}

export function transformPostToFeedFormat(
  post: RawPost,
  options: TransformPostOptions = {}
): FeedPost {
  const { userVote = null, isHidden = false } = options;
  
  const isPersona = !!post.persona_id;
  const author = isPersona ? post.personas : post.profiles;
  const authorData = Array.isArray(author) ? author[0] : author;
  const boardData = post.boards
    ? Array.isArray(post.boards)
      ? post.boards[0]
      : post.boards
    : null;

  return {
    id: post.id,
    title: post.title,
    score: post.score ?? 0,
    commentCount: post.comment_count ?? 0,
    boardName: boardData?.name ?? "Unknown",
    boardSlug: boardData?.slug ?? "unknown",
    authorName: authorData?.display_name ?? "Anonymous",
    authorUsername: authorData?.username ?? null,
    authorAvatarUrl: authorData?.avatar_url ?? null,
    authorId: post.author_id,
    isPersona,
    createdAt: post.created_at,
    thumbnailUrl: post.media?.[0]?.url ?? null,
    flairs: post.post_tags?.map((pt) => pt.tag?.name).filter((name): name is string => !!name) ?? [],
    userVote,
    status: post.status,
    isHidden,
  };
}
