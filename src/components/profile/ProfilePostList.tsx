"use client";

import { useEffect, useCallback, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import Link from "next/link";
import PaginationClient from "@/components/ui/PaginationClient";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
import { useFeedLoader } from "@/hooks/use-feed-loader";
import { voteComment } from "@/lib/api/votes";
import { useVote } from "@/hooks/use-vote";
import VotePill from "@/components/ui/VotePill";
import { toVoteValue } from "@/lib/vote-value";
import type { FeedPost, FormattedComment, VoteValue } from "@/lib/posts/query-builder";
import {
  buildPostsQueryParams,
  getNextCursor,
  calculateHasMore,
  type PaginatedResponse,
} from "@/lib/pagination";

function CommentVoteRow({
  commentId,
  initialScore,
  initialUserVote,
}: {
  commentId: string;
  initialScore: number;
  initialUserVote: VoteValue;
}) {
  const { score, userVote, handleVote, voteDisabled } = useVote({
    id: commentId,
    initialScore,
    initialUserVote,
    voteFn: voteComment,
  });
  return (
    <VotePill
      score={score}
      userVote={userVote}
      onVote={handleVote}
      disabled={voteDisabled}
      size="sm"
    />
  );
}

interface ProfilePostListProps {
  posts: FeedPost[];
  comments?: FormattedComment[];
  displayName: string;
  username: string;
  tab: string;
  userId?: string;
  authorId?: string;
  personaId?: string;
  isOwnProfile?: boolean;
  postsCount?: number;
  commentsCount?: number;
  savedCount?: number;
}

const DEFAULT_LIMIT = 10;

export default function ProfilePostList({
  posts: initialPosts,
  comments: initialComments,
  displayName,
  username,
  tab,
  userId,
  authorId,
  personaId,
  isOwnProfile,
  postsCount = 0,
  commentsCount = 0,
  savedCount = 0,
}: ProfilePostListProps) {
  const isMobile = useIsBreakpoint("max", 768);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Posts feed ──────────────────────────────────────────────────────────────
  const postsFetcher = useCallback(
    async ({ cursor, offset }: { cursor?: string; offset?: number }) => {
      const params = buildPostsQueryParams({
        author: authorId || undefined,
        sort: "new",
        limit: DEFAULT_LIMIT,
        cursor,
        offset,
      });
      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json() as Promise<PaginatedResponse<FeedPost>>;
    },
    [authorId],
  );

  const postsLoader = useFeedLoader<FeedPost>({
    initialItems: initialPosts,
    initialCursor: getNextCursor(initialPosts),
    initialHasMore: calculateHasMore(initialPosts, DEFAULT_LIMIT),
    fetcher: postsFetcher,
  });

  // ── Comments feed ────────────────────────────────────────────────────────────
  const commentsFetcher = useCallback(
    async ({ cursor }: { cursor?: string; offset?: number }) => {
      const params = new URLSearchParams();
      if (authorId) params.append("authorId", authorId);
      if (personaId) params.append("personaId", personaId);
      if (cursor) params.append("cursor", cursor);
      params.append("limit", DEFAULT_LIMIT.toString());
      params.append("sort", "new");
      const res = await fetch(`/api/profile/comments?${params}`);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<PaginatedResponse<FormattedComment>>;
    },
    [authorId, personaId],
  );

  const commentsLoader = useFeedLoader<FormattedComment>({
    initialItems: initialComments ?? [],
    initialCursor: getNextCursor(initialComments ?? []),
    initialHasMore: calculateHasMore(initialComments ?? [], DEFAULT_LIMIT),
    fetcher: commentsFetcher,
  });

  // ── Saved posts feed ─────────────────────────────────────────────────────────
  const savedFetcher = useCallback(async ({ cursor }: { cursor?: string; offset?: number }) => {
    const params = new URLSearchParams();
    if (cursor) params.append("cursor", cursor);
    params.append("limit", DEFAULT_LIMIT.toString());
    const res = await fetch(`/api/profile/saved?${params}`);
    if (!res.ok) throw new Error("Failed to load saved posts");
    return res.json() as Promise<PaginatedResponse<FeedPost>>;
  }, []);

  const savedLoader = useFeedLoader<FeedPost>({
    initialItems: [],
    initialHasMore: true,
    fetcher: savedFetcher,
  });

  // ── Reset loaders and page when tab changes ──────────────────────────────────
  const postsReset = postsLoader.reset;
  const commentsReset = commentsLoader.reset;

  useEffect(() => {
    setCurrentPage(1);
    if (tab === "posts") {
      postsReset(
        initialPosts,
        getNextCursor(initialPosts),
        0,
        calculateHasMore(initialPosts, DEFAULT_LIMIT),
      );
    } else if (tab === "comments") {
      commentsReset(
        initialComments ?? [],
        getNextCursor(initialComments ?? []),
        0,
        calculateHasMore(initialComments ?? [], DEFAULT_LIMIT),
      );
    }
  }, [tab, initialPosts, initialComments, postsReset, commentsReset]);

  // ── Load saved posts on first visit to saved tab ─────────────────────────────
  const savedLoadMore = savedLoader.loadMore;
  const savedItemCount = savedLoader.items.length;

  useEffect(() => {
    if (tab === "saved" && isOwnProfile && savedItemCount === 0) {
      void savedLoadMore();
    }
  }, [tab, isOwnProfile, savedItemCount, savedLoadMore]);

  // ── Active loader ────────────────────────────────────────────────────────────
  const activeLoader =
    tab === "comments" ? commentsLoader : tab === "saved" ? savedLoader : postsLoader;

  const { items, isLoading, hasMore, loadMore } = activeLoader;

  // ── Pagination state (mobile only) ───────────────────────────────────────────
  const totalItems = tab === "posts" ? postsCount : tab === "comments" ? commentsCount : savedCount;
  const totalPages = Math.ceil(totalItems / DEFAULT_LIMIT);

  const handlePageChange = useCallback(
    async (page: number) => {
      const offset = (page - 1) * DEFAULT_LIMIT;

      if (tab === "posts") {
        const params = buildPostsQueryParams({
          author: authorId || undefined,
          sort: "new",
          limit: DEFAULT_LIMIT,
          offset,
        });
        const res = await fetch(`/api/posts?${params}`);
        const data = (await res.json()) as PaginatedResponse<FeedPost>;
        postsLoader.reset(
          data.items,
          data.nextCursor,
          data.nextOffset ?? offset + data.items.length,
          data.hasMore,
        );
      } else if (tab === "comments") {
        const params = new URLSearchParams();
        if (authorId) params.append("authorId", authorId);
        if (personaId) params.append("personaId", personaId);
        params.append("limit", DEFAULT_LIMIT.toString());
        params.append("offset", offset.toString());
        const res = await fetch(`/api/profile/comments?${params}`);
        const data = (await res.json()) as PaginatedResponse<FormattedComment>;
        commentsLoader.reset(
          data.items,
          data.nextCursor,
          data.nextOffset ?? offset + data.items.length,
          data.hasMore,
        );
      } else if (tab === "saved") {
        const res = await fetch(`/api/profile/saved?limit=${DEFAULT_LIMIT}&offset=${offset}`);
        const data = (await res.json()) as PaginatedResponse<FeedPost>;
        savedLoader.reset(
          data.items,
          data.nextCursor,
          data.nextOffset ?? offset + data.items.length,
          data.hasMore,
        );
      }

      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [authorId, commentsLoader, personaId, postsLoader, savedLoader, tab],
  );

  const loadMoreRef = useInfiniteScroll(loadMore, hasMore, isLoading, {
    enabled: !isMobile,
  });

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (items.length === 0 && !isLoading) {
    return (
      <div className="rounded-2xl px-5 py-14 text-center sm:py-20">
        <div className="bg-base-300 text-base-content/70 mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full">
          <Sparkles size={24} />
        </div>
        <h2 className="text-base-content text-lg font-semibold">No {tab} yet</h2>
        <p className="text-base-content/70 mt-1 text-sm">
          {displayName || username} 還沒有內容，開始互動來建立第一筆資料。
        </p>
      </div>
    );
  }

  // ── Comments tab ──────────────────────────────────────────────────────────────
  if (tab === "comments") {
    return (
      <>
        <div className="bg-base-200 border-neutral divide-neutral divide-y overflow-hidden rounded-2xl border">
          {(items as FormattedComment[]).map((comment) => (
            <div key={comment.id} className="hover:bg-base-100/50 p-4 transition-colors">
              <div className="text-base-content/70 mb-2 text-xs">
                評論於{" "}
                <Link
                  href={`/r/${comment.boardSlug || "unknown"}/posts/${comment.postId}`}
                  className="text-base-content font-semibold hover:underline"
                >
                  {comment.postTitle}
                </Link>
                {comment.boardSlug && (
                  <>
                    {" "}
                    在{" "}
                    <Link href={`/r/${comment.boardSlug}`} className="text-accent hover:underline">
                      r/{comment.boardSlug}
                    </Link>
                  </>
                )}
              </div>
              <p className="text-base-content text-sm">{comment.body}</p>
              <div className="text-base-content/60 mt-2 flex items-center gap-3 text-xs">
                <CommentVoteRow
                  commentId={comment.id}
                  initialScore={comment.score ?? 0}
                  initialUserVote={toVoteValue(comment.userVote)}
                />
                <span>•</span>
                <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>

        <FooterControls
          isMobile={isMobile}
          hasMore={hasMore}
          isLoading={isLoading}
          loadMoreRef={loadMoreRef}
          itemCount={items.length}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </>
    );
  }

  // ── Posts / Saved tab ────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex flex-col gap-3">
        {(items as FeedPost[]).map((post) => (
          <PostRow key={post.id} {...post} userId={userId} variant="card" />
        ))}
      </div>

      <FooterControls
        isMobile={isMobile}
        hasMore={hasMore}
        isLoading={isLoading}
        loadMoreRef={loadMoreRef}
        itemCount={items.length}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </>
  );
}

// ── Shared footer: pagination (mobile) or infinite scroll sentinel (desktop) ──
function FooterControls({
  isMobile,
  hasMore,
  isLoading,
  loadMoreRef,
  itemCount,
  currentPage,
  totalPages,
  onPageChange,
}: {
  isMobile: boolean;
  hasMore: boolean;
  isLoading: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => Promise<void>;
}) {
  if (isMobile) {
    return (
      <div className="flex justify-center py-6">
        <PaginationClient
          page={currentPage}
          totalPages={totalPages}
          onPageChange={(p) => void onPageChange(p)}
          joinClassName="border-neutral border"
          buttonClassName="bg-base-100"
          activeButtonClassName="btn-primary"
        />
      </div>
    );
  }

  return (
    <>
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-4">
          {isLoading && <Loader2 size={24} className="text-base-content/50 animate-spin" />}
        </div>
      )}
      {!hasMore && itemCount > 0 && (
        <div className="text-base-content/50 py-8 text-center text-sm">You've reached the end</div>
      )}
    </>
  );
}
