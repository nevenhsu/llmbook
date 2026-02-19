import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import BoardLayout from "@/components/board/BoardLayout";
import { isAdmin } from "@/lib/admin";
import { isBoardModerator } from "@/lib/board-permissions";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { sortPosts, type SortType } from "@/lib/ranking";
import { toVoteValue } from "@/lib/vote-value";
import {
  buildPostsQuery,
  fetchUserInteractions,
  isRawPost,
  transformPostToFeedFormat,
  type FeedPost,
  type RawPost,
} from "@/lib/posts/query-builder";
import { Archive } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sort?: string; t?: string }>;
}

function toSortType(value: string | undefined): SortType {
  if (
    value === "new" ||
    value === "hot" ||
    value === "rising" ||
    value === "top" ||
    value === "best"
  ) {
    return value;
  }
  return "hot";
}

export default async function BoardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const searchParamsResolved = await searchParams;
  const sortBy = toSortType(searchParamsResolved?.sort);
  const timeRange = searchParamsResolved?.t || "all";

  const supabase = await createClient();
  const board = await getBoardBySlug(slug);

  // Board not found is handled by layout.tsx, which will call notFound()
  if (!board) {
    return null;
  }

  const user = await getUser();

  // Check if user is admin or moderator (need this early for query)
  let userIsAdmin = false;
  let canManageBoard = false;
  let canViewArchived = false;

  if (user) {
    userIsAdmin = await isAdmin(user.id, supabase);

    canManageBoard = await isBoardModerator(board.id, user.id, supabase);
    canViewArchived = userIsAdmin || canManageBoard;
  }

  // Build and fetch posts using query builder
  const postsQuery = buildPostsQuery({
    supabase,
    boardId: board.id,
    sortBy,
    timeRange,
    canViewArchived,
    limit: 100,
  });
  const { data: postData } = await postsQuery;

  // Sort posts using ranking algorithm
  const rawPosts = (Array.isArray(postData) ? (postData as unknown[]) : []).filter(isRawPost);
  const sortedPosts = sortPosts(rawPosts, sortBy);
  const topPosts = sortedPosts.slice(0, 20);

  // Fetch user interactions (votes + hidden status + saved status) for displayed posts
  const postIds = topPosts.map((p) => p.id);
  const {
    votes: userVotes,
    hiddenPostIds,
    savedPostIds,
  } = user
    ? await fetchUserInteractions(supabase, user.id, postIds)
    : { votes: {}, hiddenPostIds: new Set<string>(), savedPostIds: new Set<string>() };

  // Transform posts to feed format
  const posts: FeedPost[] = topPosts.map((post) => {
    const userVote = toVoteValue(userVotes[post.id]);
    return transformPostToFeedFormat(post, {
      userVote,
      isHidden: hiddenPostIds.has(post.id),
      isSaved: savedPostIds.has(post.id),
    });
  });

  // Check if user is joined to the board
  let isJoined = false;
  const canManage = userIsAdmin || canManageBoard;

  if (user) {
    const { data: membership } = await supabase
      .from("board_members")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("board_id", board.id)
      .maybeSingle();

    isJoined = !!membership;
  }

  return (
    <BoardLayout
      board={{ ...board, rules: board.rules ?? undefined }}
      slug={slug}
      isJoined={isJoined}
      canManage={canManage}
      isAdmin={userIsAdmin}
    >
      {/* Archived Banner */}
      {board.is_archived && (
        <div className="sm:rounded-box bg-warning/10 border-warning mb-4 rounded-none border-y px-4 py-3 sm:border">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="flex items-center gap-2">
              <Archive size={18} className="text-warning shrink-0" />
              <p className="text-warning text-sm">
                This community has been archived and is read-only
              </p>
            </div>
          </div>
        </div>
      )}

      <FeedSortBar basePath={`/r/${slug}`} />
      <FeedContainer
        initialPosts={posts}
        userId={user?.id}
        boardSlug={slug}
        sortBy={sortBy}
        timeRange={timeRange}
        canViewArchived={canViewArchived}
      />
    </BoardLayout>
  );
}
