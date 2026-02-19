import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHotPostsFromCache, getRisingPostsFromCache } from "@/lib/ranking";
import { isAdmin } from "@/lib/admin";
import { canManageBoard } from "@/lib/board-permissions";
import { http, parseJsonBody, validateBody, withAuth } from "@/lib/server/route-helpers";
import { getPaginationMode, type PaginatedResponse } from "@/lib/pagination";
import { toVoteValue } from "@/lib/vote-value";
import {
  buildPostsQuery,
  fetchUserInteractions,
  isRawPost,
  type FeedPost,
  type RawPost,
  transformPostToFeedFormat,
} from "@/lib/posts/query-builder";
import type { SortType } from "@/lib/ranking";
import { NOTIFICATION_TYPES } from "@/types/notification";
import { parseMentions } from "@/lib/mention-parser";
import { getFollowersToNotify } from "@/lib/notification-throttle";

export const runtime = "nodejs";

// Cache for 60 seconds in production
export const revalidate = 60;

export async function GET(request: Request) {
  const startTime = Date.now();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const board = searchParams.get("board");
  const tag = searchParams.get("tag");
  const author = searchParams.get("author");
  const cursor = searchParams.get("cursor");
  const offsetParam = searchParams.get("offset");
  const sort = searchParams.get("sort") || "new";
  const t = searchParams.get("t") || "today";
  const includeArchived = searchParams.get("includeArchived") === "true";
  const includeDeletedParam = searchParams.get("includeDeleted");
  const includeDeleted =
    includeDeletedParam == null
      ? true
      : includeDeletedParam === "true" || includeDeletedParam === "1";
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20, 50);
  const pageLimit = limit + 1;

  // Parallel execution of independent queries
  const [
    {
      data: { user },
    },
    boardData,
    tagData,
  ] = await Promise.all([
    supabase.auth.getUser(),
    board
      ? supabase.from("boards").select("id").eq("slug", board).maybeSingle()
      : Promise.resolve({ data: null }),
    tag
      ? supabase.from("tags").select("id").eq("slug", tag).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const boardId = boardData?.data?.id ?? null;
  const tagId = tagData?.data?.id ?? null;

  const sortBy: SortType =
    sort === "new" || sort === "top" || sort === "hot" || sort === "rising" ? sort : "new";
  const paginationMode = getPaginationMode(sortBy, !!tagId);

  const parsedOffset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;
  const offsetFromParam =
    typeof parsedOffset === "number" && Number.isFinite(parsedOffset) && parsedOffset >= 0
      ? parsedOffset
      : undefined;
  const offsetFromCursor =
    paginationMode === "offset" && cursor && /^\d+$/.test(cursor)
      ? Number.parseInt(cursor, 10)
      : undefined;
  const offset = offsetFromParam ?? offsetFromCursor ?? 0;

  // Check if user can view archived posts
  let canViewArchived = false;
  if (user && includeArchived) {
    const userIsAdmin = await isAdmin(user.id, supabase);
    if (userIsAdmin) {
      canViewArchived = true;
    } else if (boardId) {
      canViewArchived = await canManageBoard(boardId, user.id, supabase);
    }
  }

  const allowedStatuses = canViewArchived
    ? includeDeleted
      ? ["PUBLISHED", "ARCHIVED", "DELETED"]
      : ["PUBLISHED", "ARCHIVED"]
    : includeDeleted
      ? ["PUBLISHED", "DELETED"]
      : ["PUBLISHED"];

  if ((board && !boardId) || (tag && !tagId)) {
    const empty: PaginatedResponse<FeedPost> = { items: [], hasMore: false };
    return NextResponse.json(empty);
  }

  let rawPosts: RawPost[] = [];
  let useCache = false;

  // Use cached rankings for hot and rising sorts
  if (sortBy === "hot" && !tagId && !author) {
    const { posts: cachedPosts, error } = await getHotPostsFromCache(supabase, {
      boardId: boardId || undefined,
      limit: pageLimit,
      offset,
    });

    if (!error && cachedPosts.length > 0) {
      rawPosts = cachedPosts as unknown as RawPost[];
      useCache = true;
    }
  } else if (sortBy === "rising" && !tagId && !author) {
    const { posts: cachedPosts, error } = await getRisingPostsFromCache(supabase, {
      boardId: boardId || undefined,
      limit: pageLimit,
      offset,
    });

    if (!error && cachedPosts.length > 0) {
      rawPosts = cachedPosts as unknown as RawPost[];
      useCache = true;
    }
  }

  // If not using cache, query posts directly using query builder
  if (!useCache) {
    const postsQuery = buildPostsQuery({
      supabase,
      boardId: boardId || undefined,
      tagId: tagId || undefined,
      authorId: author || undefined,
      sortBy,
      timeRange: t,
      canViewArchived,
      includeDeleted,
      limit: pageLimit,
      offset: sortBy === "top" ? offset : undefined,
      cursor: sortBy === "new" && paginationMode === "cursor" && cursor ? cursor : undefined,
    });

    const { data, error } = await postsQuery;

    if (error) {
      console.error("API Error:", error);
      return http.internalError(error.message);
    }

    rawPosts = (Array.isArray(data) ? (data as unknown[]) : []).filter(isRawPost);
  }

  // Enforce status visibility consistently (including cached paths)
  rawPosts = rawPosts.filter(
    (p) => typeof p?.status === "string" && allowedStatuses.includes(p.status),
  );

  const rawPagePosts = rawPosts.slice(0, limit);
  const hasMore = rawPosts.length > limit;
  let posts: FeedPost[] = [];

  // Fetch user interactions (votes + hidden status + saved status) for displayed posts
  if (user && rawPagePosts.length > 0) {
    const postIds = rawPagePosts.map((p) => p.id);
    const {
      votes: userVotes,
      hiddenPostIds,
      savedPostIds,
    } = await fetchUserInteractions(supabase, user.id, postIds);

    // Add userVote, isHidden, isSaved and transform to FeedPost format
    posts = rawPagePosts.map((post) => {
      const userVote = toVoteValue(userVotes[post.id]);
      return transformPostToFeedFormat(post, {
        userVote,
        isHidden: hiddenPostIds.has(post.id),
        isSaved: savedPostIds.has(post.id),
      });
    });
  } else {
    // Transform all posts to FeedPost format even if no user logged in
    posts = rawPagePosts.map((post) => transformPostToFeedFormat(post));
  }

  const duration = Date.now() - startTime;
  console.log(
    `API /posts: ${posts.length} posts in ${duration}ms (sort: ${sortBy}, cached: ${useCache})`,
  );

  const responseBody: PaginatedResponse<FeedPost> = {
    items: posts,
    hasMore,
    nextCursor: paginationMode === "cursor" ? posts[posts.length - 1]?.createdAt : undefined,
    nextOffset: paginationMode === "offset" ? offset + posts.length : undefined,
  };

  return NextResponse.json(responseBody, {
    headers: {
      "X-Response-Time": `${duration}ms`,
      "X-Cache-Hit": useCache ? "1" : "0",
    },
  });
}

export const POST = withAuth(async (request, { user, supabase }) => {
  const bodyResult = await parseJsonBody<Record<string, unknown>>(request);
  if (bodyResult instanceof NextResponse) {
    return bodyResult;
  }

  const validation = validateBody(bodyResult, ["title", "boardId"]);
  if (!validation.valid) {
    return validation.response;
  }

  type PostType = "text" | "link" | "poll";

  const title = validation.data.title;
  const body = validation.data.body;
  const boardId = validation.data.boardId;
  const tagIds = validation.data.tagIds;
  const mediaIds = validation.data.mediaIds;
  const postType = (validation.data.postType ?? "text") as unknown;
  const linkUrl = validation.data.linkUrl;
  const pollOptions = validation.data.pollOptions;
  const pollDuration = validation.data.pollDuration;

  if (typeof title !== "string" || !title.trim()) {
    return http.badRequest("Title is required");
  }
  if (typeof boardId !== "string" || !boardId) {
    return http.badRequest("boardId is required");
  }

  const resolvedPostType: PostType =
    postType === "text" || postType === "link" || postType === "poll" ? postType : "text";

  // DB requires non-null `posts.body`; allow empty body for polls/links/images-only posts.
  const resolvedBody = typeof body === "string" ? body : "";

  const resolvedTagIds = Array.isArray(tagIds)
    ? tagIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const resolvedMediaIds = Array.isArray(mediaIds)
    ? mediaIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  const resolvedLinkUrl = typeof linkUrl === "string" ? linkUrl : null;
  const resolvedPollDurationDays =
    typeof pollDuration === "number" && Number.isFinite(pollDuration)
      ? pollDuration
      : typeof pollDuration === "string"
        ? Number.parseInt(pollDuration, 10)
        : null;
  const resolvedPollOptions = Array.isArray(pollOptions)
    ? pollOptions
        .map((opt) => {
          if (typeof opt === "string") {
            return opt;
          }
          if (opt && typeof opt === "object" && "text" in opt) {
            const text = (opt as { text?: unknown }).text;
            return typeof text === "string" ? text : "";
          }
          return "";
        })
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];

  // Allow text posts with just images (body can be empty or contain only HTML tags)
  // Removed body requirement for text posts since images are allowed

  if (resolvedPostType === "link" && !resolvedLinkUrl) {
    return http.badRequest("Link URL required for link posts");
  }

  if (resolvedPostType === "poll") {
    if (resolvedPollOptions.length < 2 || resolvedPollOptions.length > 6) {
      return http.badRequest("Poll must have 2-6 options");
    }

    if (
      pollDuration != null &&
      (resolvedPollDurationDays === null ||
        !Number.isInteger(resolvedPollDurationDays) ||
        resolvedPollDurationDays <= 0)
    ) {
      return http.badRequest("pollDuration must be a positive integer number of days");
    }
  }

  // Check if user is banned from the board
  const { canPostInBoard, isUserBanned } = await import("@/lib/board-permissions");
  const canPost = await canPostInBoard(boardId, user.id, supabase);

  if (!canPost) {
    const banned = await isUserBanned(boardId, user.id, supabase);
    if (banned) {
      return http.forbidden("You are banned from this board");
    }
    return http.forbidden("Cannot post in this board");
  }

  // Calculate expires_at for polls
  let expiresAt: string | null = null;
  if (resolvedPostType === "poll" && resolvedPollDurationDays !== null) {
    const durationDays = resolvedPollDurationDays;
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    expiresAt = expirationDate.toISOString();
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      title,
      body: resolvedBody,
      board_id: boardId,
      author_id: user.id,
      status: "PUBLISHED",
      post_type: resolvedPostType,
      link_url: resolvedLinkUrl,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !post) {
    return http.badRequest(error?.message ?? "Could not create post");
  }

  // Create poll options if poll post
  if (resolvedPostType === "poll") {
    const optionsToInsert = resolvedPollOptions.map((text, idx) => ({
      post_id: post.id,
      text,
      position: idx,
    }));

    const { error: pollError } = await supabase.from("poll_options").insert(optionsToInsert);

    if (pollError) {
      // Rollback: delete the post
      await supabase.from("posts").delete().eq("id", post.id);
      return http.badRequest("Failed to create poll options");
    }
  }

  if (resolvedTagIds.length > 0) {
    const tagRows = resolvedTagIds.map((tagId) => ({ post_id: post.id, tag_id: tagId }));
    const { error: tagError } = await supabase.from("post_tags").insert(tagRows);
    if (tagError) {
      return http.badRequest(tagError.message);
    }
  }

  if (resolvedMediaIds.length > 0) {
    const { error: mediaError } = await supabase
      .from("media")
      .update({ post_id: post.id })
      .in("id", resolvedMediaIds)
      .eq("user_id", user.id);

    if (mediaError) {
      return http.badRequest(mediaError.message);
    }
  }

  // Fetch board slug for redirect
  const { data: boardData } = await supabase
    .from("boards")
    .select("slug")
    .eq("id", boardId)
    .single();

  console.log("Created post:", post.id, "in board:", boardId, "slug:", boardData?.slug);

  // Send notifications to followers and mentions
  // Run asynchronously to not block the response
  void (async () => {
    try {
      // Get followers to notify (with 24h throttling)
      const followersToNotify = await getFollowersToNotify(supabase, user.id);

      if (followersToNotify.length > 0) {
        const { data: author } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("user_id", user.id)
          .single();

        // Batch insert notifications
        const notifications = followersToNotify.map((followerId) => ({
          user_id: followerId,
          type: NOTIFICATION_TYPES.FOLLOWED_USER_POST,
          payload: {
            postId: post.id,
            postTitle: title,
            authorId: user.id,
            authorUsername: author?.username || "",
            authorDisplayName: author?.display_name || "Someone",
          },
        }));

        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }

      // Send mention notifications
      const mentions = parseMentions(resolvedBody);
      if (mentions.length > 0) {
        const { data: author } = await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("user_id", user.id)
          .single();

        const mentionNotifications = mentions
          .filter((m) => m.userId !== user.id) // Don't notify self
          .map((m) => ({
            user_id: m.userId,
            type: NOTIFICATION_TYPES.MENTION,
            payload: {
              postId: post.id,
              postTitle: title,
              authorId: user.id,
              authorUsername: author?.username || "",
              authorDisplayName: author?.display_name || "Someone",
            },
          }));

        if (mentionNotifications.length > 0) {
          await supabase.from("notifications").insert(mentionNotifications);
        }
      }
    } catch (error) {
      console.error("Error sending notifications:", error);
    }
  })();

  return http.ok({
    id: post.id,
    boardSlug: boardData?.slug || null,
  });
});
