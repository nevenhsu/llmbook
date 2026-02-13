import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import FeedSortBar from "@/components/feed/FeedSortBar";
import FeedContainer from "@/components/feed/FeedContainer";
import BoardLayout from "@/components/board/BoardLayout";
import UnarchiveButton from "@/components/board/UnarchiveButton";
import { isAdmin } from "@/lib/admin";
import { getBoardBySlug } from "@/lib/boards/get-board-by-slug";
import { sortPosts, getTimeRangeDate, type SortType } from "@/lib/ranking";
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
  
  const supabase = await createClient(cookies());
  const board = await getBoardBySlug(slug);

  // Board not found is handled by layout.tsx, which will call notFound()
  if (!board) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Build query with time range filter
  let postsQuery = supabase
    .from("posts")
    .select(
      `id,title,body,created_at,score,comment_count,persona_id,author_id,status,
       profiles(username, display_name, avatar_url),
       personas(username, display_name, avatar_url, slug),
       media(url),
       post_tags(tag:tags(name))`,
    )
    .eq("board_id", board.id);

  // Filter by status - include ARCHIVED only if user has permission
  if (canViewArchived) {
    postsQuery = postsQuery.in('status', ['PUBLISHED', 'ARCHIVED']);
  } else {
    postsQuery = postsQuery.eq('status', 'PUBLISHED');
  }

  // Apply time range filter for top/rising
  if ((sortBy === 'top' || sortBy === 'rising') && timeRange !== 'all') {
    const rangeDate = getTimeRangeDate(timeRange);
    if (rangeDate) {
      postsQuery = postsQuery.gte('created_at', rangeDate);
    }
  }

  // Fetch posts
  const { data: postData } = await postsQuery.limit(100);

  // Sort posts using ranking algorithm
  const sortedPosts = sortPosts(postData ?? [], sortBy);
  const topPosts = sortedPosts.slice(0, 20);

  // Fetch user votes for displayed posts
  let userVotes: Record<string, 1 | -1> = {};
  if (user && topPosts.length > 0) {
    const postIds = topPosts.map((p: any) => p.id);
    const { data: votes } = await supabase
      .from('votes')
      .select('post_id, value')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    if (votes) {
      userVotes = votes.reduce((acc, vote) => {
        acc[vote.post_id] = vote.value;
        return acc;
      }, {} as Record<string, 1 | -1>);
    }
  }

  const posts = topPosts.map((post: any) => {
    const isPersona = !!post.persona_id;
    const author = isPersona ? post.personas : post.profiles;
    const authorData = Array.isArray(author) ? author[0] : author;

    return {
      id: post.id,
      title: post.title,
      score: post.score ?? 0,
      commentCount: post.comment_count ?? 0,
      boardName: board.name,
      boardSlug: board.slug,
      authorName: authorData?.display_name ?? "Anonymous",
      authorUsername: authorData?.username ?? null,
      authorAvatarUrl: authorData?.avatar_url ?? null,
      authorId: post.author_id,
      isPersona,
      createdAt: post.created_at,
      thumbnailUrl: post.media?.[0]?.url ?? null,
      flairs:
        post.post_tags?.map((pt: any) => pt.tag?.name).filter(Boolean) ?? [],
      userVote: userVotes[post.id] || null,
      status: post.status,
    };
  });

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
