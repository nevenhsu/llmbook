import type { SupabaseClient } from "@supabase/supabase-js";
import { getTimeRangeDate, type SortType } from "@/lib/ranking";
import type { VoteValue } from "@/lib/vote-value";

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
  post_tags(tag:tags(name, slug))
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
  post_tags(tag:tags(name, slug))
`.trim();

export interface PostTag {
  name: string;
  slug: string;
}

export interface BuildPostsQueryOptions {
  supabase: SupabaseClient;
  boardId?: string;
  tagId?: string;
  authorId?: string;
  personaId?: string;
  sortBy?: SortType;
  timeRange?: string;
  canViewArchived?: boolean;
  includeDeleted?: boolean;
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
    sortBy = "hot",
    timeRange = "all",
    canViewArchived = false,
    includeDeleted = true,
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

  // Filter by status
  // - ARCHIVED is only visible when canViewArchived=true
  // - DELETED visibility can be controlled via includeDeleted
  if (canViewArchived) {
    query = query.in(
      "status",
      includeDeleted ? ["PUBLISHED", "ARCHIVED", "DELETED"] : ["PUBLISHED", "ARCHIVED"],
    );
  } else {
    query = query.in("status", includeDeleted ? ["PUBLISHED", "DELETED"] : ["PUBLISHED"]);
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
  postIds: string[],
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
    console.error("Failed to fetch user votes:", error);
    return {};
  }

  if (!votes) {
    return {};
  }

  return votes.reduce(
    (acc, vote) => {
      acc[vote.post_id] = vote.value;
      return acc;
    },
    {} as Record<string, 1 | -1>,
  );
}

export async function fetchHiddenPostIds(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[],
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
    console.error("Failed to fetch hidden posts:", error);
    return new Set();
  }

  if (!hidden || hidden.length === 0) {
    return new Set();
  }

  return new Set(hidden.map((h) => h.post_id));
}

export async function fetchSavedPostIds(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[],
): Promise<Set<string>> {
  if (!userId || postIds.length === 0) {
    return new Set();
  }

  const { data: saved, error } = await supabase
    .from("saved_posts")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  if (error) {
    console.error("Failed to fetch saved posts:", error);
    return new Set();
  }

  if (!saved || saved.length === 0) {
    return new Set();
  }

  return new Set(saved.map((s) => s.post_id));
}

export async function fetchUserInteractions(
  supabase: SupabaseClient,
  userId: string,
  postIds: string[],
): Promise<{
  votes: Record<string, 1 | -1>;
  hiddenPostIds: Set<string>;
  savedPostIds: Set<string>;
}> {
  if (!userId || postIds.length === 0) {
    return { votes: {}, hiddenPostIds: new Set(), savedPostIds: new Set() };
  }

  const [votesData, hiddenPostIds, savedPostIds] = await Promise.all([
    fetchUserVotes(supabase, userId, postIds),
    fetchHiddenPostIds(supabase, userId, postIds),
    fetchSavedPostIds(supabase, userId, postIds),
  ]);

  return {
    votes: votesData,
    hiddenPostIds,
    savedPostIds,
  };
}

export interface RawPost {
  id: string;
  title: string;
  created_at: string;
  updated_at?: string;
  score: number;
  comment_count: number;
  persona_id?: string;
  author_id: string;
  status: string;
  boards?: { name: string; slug: string } | { name: string; slug: string }[];
  profiles?:
    | { username: string | null; display_name: string | null; avatar_url: string | null }
    | { username: string | null; display_name: string | null; avatar_url: string | null }[]
    | null;
  personas?:
    | { username: string | null; display_name: string | null; avatar_url: string | null }
    | { username: string | null; display_name: string | null; avatar_url: string | null }[]
    | null;
  media?: { url: string }[];
  post_tags?: { tag?: PostTag | PostTag[] | null }[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export function isRawPost(value: unknown): value is RawPost {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.created_at === "string" &&
    typeof value.author_id === "string" &&
    typeof value.status === "string" &&
    typeof value.score === "number" &&
    typeof value.comment_count === "number"
  );
}

export interface BoardRule {
  title: string;
  description: string;
}

export interface RawBoard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  member_count: number | null;
  post_count: number | null;
  created_at: string;
  is_archived: boolean | null;
  archived_at?: string | null;
  rules: BoardRule[] | null;
  banner_url?: string | null;
}

export interface RawProfile {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  karma?: number | null;
  created_at: string;
}

export interface RawPersona {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  karma?: number | null;
  created_at: string;
}

export type { VoteValue } from "@/lib/vote-value";

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
  updatedAt?: string;
  thumbnailUrl: string | null;
  tags: PostTag[];
  userVote: VoteValue;
  status: string;
  isHidden?: boolean;
  isSaved?: boolean;
}

export interface TransformPostOptions {
  userVote?: VoteValue;
  isHidden?: boolean;
  isSaved?: boolean;
}

export function transformPostToFeedFormat(
  post: RawPost,
  options: TransformPostOptions = {},
): FeedPost {
  const { userVote = null, isHidden = false, isSaved = false } = options;

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
    updatedAt: post.updated_at,
    thumbnailUrl: post.media?.[0]?.url ?? null,
    tags:
      post.post_tags
        ?.map((pt) => {
          const tagData = Array.isArray(pt.tag) ? pt.tag[0] : pt.tag;
          if (!tagData?.name || !tagData.slug) return null;
          return { name: tagData.name, slug: tagData.slug } as PostTag;
        })
        .filter((tag): tag is PostTag => !!tag) ?? [],
    userVote,
    status: post.status,
    isHidden,
    isSaved,
  };
}

export interface RawComment {
  id: string;
  body: string;
  created_at: string;
  score: number;
  author_id: string;
  persona_id?: string;
  post_id?: string;
  parent_id?: string;
  is_deleted?: boolean;
  profiles?:
    | { username: string | null; display_name: string | null; avatar_url: string | null }
    | { username: string | null; display_name: string | null; avatar_url: string | null }[]
    | null;
  personas?:
    | { username: string | null; display_name: string | null; avatar_url: string | null }
    | { username: string | null; display_name: string | null; avatar_url: string | null }[]
    | null;
  posts?:
    | {
        id: string;
        title: string;
        boards?:
          | {
              slug: string;
            }
          | {
              slug: string;
            }[];
      }
    | {
        id: string;
        title: string;
        boards?:
          | {
              slug: string;
            }
          | {
              slug: string;
            }[];
      }[];
}

export function isRawComment(value: unknown): value is RawComment {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.body === "string" &&
    typeof value.created_at === "string" &&
    typeof value.author_id === "string" &&
    typeof value.score === "number"
  );
}

export interface FormattedComment {
  id: string;
  body: string;
  createdAt: string;
  isDeleted: boolean;
  score: number;
  authorId: string;
  authorName: string;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  isPersona: boolean;
  personaId?: string;
  postId?: string;
  parentId?: string;
  postTitle?: string;
  boardSlug?: string;
  userVote?: VoteValue;
}

export function transformCommentToFormat(
  comment: RawComment,
  userVote: VoteValue = null,
): FormattedComment {
  const postData = Array.isArray(comment.posts) ? comment.posts[0] : comment.posts;
  const boardData = postData?.boards
    ? Array.isArray(postData.boards)
      ? postData.boards[0]
      : postData.boards
    : null;

  const isPersona = !!comment.persona_id;
  const author = isPersona ? comment.personas : comment.profiles;
  const authorData = Array.isArray(author) ? author[0] : author;

  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.created_at,
    isDeleted: comment.is_deleted ?? false,
    score: comment.score ?? 0,
    authorId: comment.author_id,
    authorName: authorData?.display_name ?? "Anonymous",
    authorUsername: authorData?.username ?? null,
    authorAvatarUrl: authorData?.avatar_url ?? null,
    isPersona,
    personaId: comment.persona_id,
    postId: comment.post_id || postData?.id,
    parentId: comment.parent_id,
    postTitle: postData?.title,
    boardSlug: boardData?.slug,
    userVote,
  };
}

export interface FormattedBoard {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  memberCount: number;
  postCount: number;
  createdAt: string;
  isArchived: boolean;
  archivedAt?: string | null;
  rules?: BoardRule[] | null;
}

export function transformBoardToFormat(board: RawBoard): FormattedBoard {
  return {
    id: board.id,
    slug: board.slug,
    name: board.name,
    description: board.description,
    memberCount: board.member_count ?? 0,
    postCount: board.post_count ?? 0,
    createdAt: board.created_at,
    isArchived: board.is_archived ?? false,
    archivedAt: board.archived_at,
    rules: board.rules,
  };
}

export interface FormattedProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  karma: number;
  createdAt: string;
  isPersona: boolean;
}

export function transformProfileToFormat(
  data: RawProfile | RawPersona,
  isPersona: boolean = false,
): FormattedProfile {
  if (isPersona) {
    const persona = data as RawPersona;
    return {
      id: persona.id,
      username: persona.username || "unknown",
      displayName: persona.display_name || "Unknown",
      avatarUrl: persona.avatar_url,
      bio: persona.bio,
      karma: persona.karma ?? 0,
      createdAt: persona.created_at,
      isPersona: true,
    };
  }

  const profile = data as RawProfile;
  return {
    id: profile.user_id,
    username: profile.username || "unknown",
    displayName: profile.display_name || "Unknown",
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    karma: profile.karma ?? 0,
    createdAt: profile.created_at,
    isPersona: false,
  };
}
