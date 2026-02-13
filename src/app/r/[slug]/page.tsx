import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/get-user";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import BoardLayout from "@/components/board/BoardLayout";
import UnarchiveButton from "@/components/board/UnarchiveButton";
import { isAdmin } from "@/lib/admin";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { sortPosts, type SortType } from "@/lib/ranking";
import { buildPostsQuery, fetchUserInteractions, transformPostToFeedFormat } from "@/lib/posts/query-builder";
import { Archive } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ sort?: string; t?: string }>;
}

export default async function BoardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const searchParamsResolved = await searchParams;
  const sortBy = (searchParamsResolved?.sort || 'hot') as SortType;
  const timeRange = searchParamsResolved?.t || 'all';
  
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
    
    const { data: moderator } = await supabase
      .from('board_moderators')
      .select('role')
      .eq('board_id', board.id)
      .eq('user_id', user.id)
      .maybeSingle();
    
    canManageBoard = !!moderator;
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
  const sortedPosts = sortPosts((postData as any[]) ?? [], sortBy);
  const topPosts = sortedPosts.slice(0, 20);

  // Fetch user interactions (votes + hidden status + saved status) for displayed posts
  const postIds = topPosts.map((p: any) => p.id);
  const { votes: userVotes, hiddenPostIds, savedPostIds } = user
    ? await fetchUserInteractions(supabase, user.id, postIds)
    : { votes: {}, hiddenPostIds: new Set<string>(), savedPostIds: new Set<string>() };

  // Transform posts to feed format
  const posts = topPosts.map((post: any) =>
    transformPostToFeedFormat(post, {
      userVote: userVotes[post.id] || null,
      isHidden: hiddenPostIds.has(post.id),
      isSaved: savedPostIds.has(post.id),
    })
  );

  // Check if user is joined to the board
  let isJoined = false;
  let canManage = canManageBoard;
  
  if (user) {
    const { data: membership } = await supabase
      .from('board_members')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('board_id', board.id)
      .maybeSingle();
    
    isJoined = !!membership;
  }

  return (
    <BoardLayout
      board={{ ...board, rules: board.rules ?? undefined }}
      slug={slug}
      isJoined={isJoined}
      canManage={canManage}
    >
      {/* Archived Banner */}
      {board.is_archived && (
        <div className="rounded-none sm:rounded-box bg-warning/10 border-y sm:border border-warning px-4 py-3 mb-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Archive size={18} className="text-warning shrink-0" />
              <p className="text-sm text-warning">
                This community has been archived and is read-only
              </p>
            </div>
            {userIsAdmin && <UnarchiveButton slug={board.slug} compact />}
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
