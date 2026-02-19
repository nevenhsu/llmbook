"use client";

import { useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
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
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(calculateHasMore(initialPosts, DEFAULT_LIMIT));
  const [offset, setOffset] = useState(initialPosts.length);
  const [cursor, setCursor] = useState<string | undefined>(getNextCursor(initialPosts));
  // Determine pagination mode
  const paginationMode = useMemo(() => getPaginationMode(sortBy, !!tagSlug), [sortBy, tagSlug]);

  // Tag feeds always use 'new' sort and no time range
  const effectiveSortBy = tagSlug ? "new" : sortBy;
  const effectiveTimeRange = tagSlug ? "all" : timeRange;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      // Build query params based on pagination mode
      const params = buildPostsQueryParams({
        board: boardSlug,
        tag: tagSlug,
        sort: effectiveSortBy,
        timeRange: effectiveTimeRange,
        includeArchived: canViewArchived,
        limit: DEFAULT_LIMIT,
        // Use appropriate pagination parameter based on mode
        ...(paginationMode === "cursor" && cursor ? { cursor } : { offset }),
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");

      const data = (await res.json()) as PaginatedResponse<FeedPost>;
      const newPosts = Array.isArray(data?.items) ? data.items : [];

      setHasMore(!!data?.hasMore);

      if (paginationMode === "cursor") {
        setCursor(typeof data?.nextCursor === "string" ? data.nextCursor : getNextCursor(newPosts));
      } else {
        setOffset(
          typeof data?.nextOffset === "number" ? data.nextOffset : offset + newPosts.length,
        );
      }

      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    boardSlug,
    canViewArchived,
    cursor,
    effectiveSortBy,
    effectiveTimeRange,
    hasMore,
    isLoading,
    offset,
    paginationMode,
    tagSlug,
  ]);

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

      {/* Infinite scroll trigger */}
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
