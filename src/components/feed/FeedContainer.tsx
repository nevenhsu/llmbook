"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useFeedLoader } from "@/hooks/use-feed-loader";
import type { FeedPost } from "@/lib/posts/query-builder";

import {
  buildPostsQueryParams,
  getNextCursor,
  calculateHasMore,
  getPaginationMode,
  type PaginatedResponse,
} from "@/lib/pagination";

interface FeedContainerProps {
  initialPosts: FeedPost[];
  userId?: string;
  boardSlug?: string;
  tagSlug?: string;
  sortBy?: string;
  timeRange?: string;
  canViewArchived?: boolean;
}

const DEFAULT_LIMIT = 20;

export default function FeedContainer({
  initialPosts,
  userId,
  boardSlug,
  tagSlug,
  sortBy = "hot",
  timeRange = "all",
  canViewArchived = false,
}: FeedContainerProps) {
  // Tag feeds always use 'new' sort and no time range
  const effectiveSortBy = tagSlug ? "new" : sortBy;
  const effectiveTimeRange = tagSlug ? "all" : timeRange;
  const paginationMode = getPaginationMode(effectiveSortBy, !!tagSlug);

  const fetcher = useCallback(
    async ({ cursor, offset }: { cursor?: string; offset?: number }) => {
      const params = buildPostsQueryParams({
        board: boardSlug,
        tag: tagSlug,
        sort: effectiveSortBy,
        timeRange: effectiveTimeRange,
        includeArchived: canViewArchived,
        limit: DEFAULT_LIMIT,
        ...(paginationMode === "cursor" && cursor ? { cursor } : { offset }),
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json() as Promise<PaginatedResponse<FeedPost>>;
    },
    [boardSlug, canViewArchived, effectiveSortBy, effectiveTimeRange, paginationMode, tagSlug],
  );

  const {
    items: posts,
    isLoading,
    hasMore,
    loadMore,
  } = useFeedLoader<FeedPost>({
    initialItems: initialPosts,
    initialCursor: paginationMode === "cursor" ? getNextCursor(initialPosts) : undefined,
    initialOffset: paginationMode === "offset" ? initialPosts.length : 0,
    initialHasMore: calculateHasMore(initialPosts, DEFAULT_LIMIT),
    fetcher,
  });

  const loadMoreRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  const emptyMessage = tagSlug
    ? { title: "No posts with this tag yet", subtitle: "Be the first to use this tag!" }
    : { title: "No posts yet", subtitle: "Be the first to post something!" };

  return (
    <>
      {posts.length === 0 && !isLoading ? (
        <div className="border-neutral bg-base-200 text-base-content/70 rounded-md border py-20 text-center">
          <p className="text-lg">{emptyMessage.title}</p>
          <p className="mt-1 text-sm">{emptyMessage.subtitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostRow key={post.id} {...post} userId={userId} variant="card" />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {isLoading && <Loader2 size={24} className="text-base-content/50 animate-spin" />}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-base-content/50 py-8 text-center text-sm">You've reached the end</div>
      )}
    </>
  );
}
