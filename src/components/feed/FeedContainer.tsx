"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Loader2 } from "lucide-react";
import PostRow from "@/components/post/PostRow";

import {
  buildPostsQueryParams,
  getNextCursor,
  calculateHasMore,
  getPaginationMode,
  createInitialPaginationState,
  updatePaginationState,
} from "@/lib/pagination";

interface FeedContainerProps {
  initialPosts: any[];
  userId?: string;
  boardSlug?: string;
  tagSlug?: string;
  sortBy?: string;
  timeRange?: string;
  canViewArchived?: boolean;
  enableSort?: boolean;
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
  enableSort = true,
}: FeedContainerProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(calculateHasMore(initialPosts, DEFAULT_LIMIT));
  const [page, setPage] = useState(1);
  const [cursor, setCursor] = useState<string | undefined>(getNextCursor(initialPosts));
  const loadMoreRef = useRef<HTMLDivElement>(null);
  // Determine pagination mode
  const paginationMode = useMemo(() => getPaginationMode(sortBy, !!tagSlug), [sortBy, tagSlug]);

  // Tag feeds always use 'new' sort and no time range
  const effectiveSortBy = tagSlug ? "new" : sortBy;
  const effectiveTimeRange = tagSlug ? "all" : timeRange;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page, cursor]);

  const loadMore = async () => {
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
        ...(paginationMode === "cursor" && cursor ? { cursor } : { offset: page * DEFAULT_LIMIT }),
      });

      const res = await fetch(`/api/posts?${params}`);
      if (!res.ok) throw new Error("Failed to load posts");

      const newPosts = await res.json();

      // Update pagination state
      const newHasMore = calculateHasMore(newPosts, DEFAULT_LIMIT);
      setHasMore(newHasMore);

      if (paginationMode === "cursor") {
        setCursor(getNextCursor(newPosts));
      } else {
        setPage((prev) => prev + 1);
      }

      setPosts((prev) => [...prev, ...newPosts]);
    } catch (err) {
      console.error("Failed to load more posts:", err);
    } finally {
      setIsLoading(false);
    }
  };

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
