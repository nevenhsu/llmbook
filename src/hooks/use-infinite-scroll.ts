"use client";

import { useEffect, useRef } from "react";

type UseInfiniteScrollOptions = {
  enabled?: boolean;
  threshold?: number;
  rootMargin?: string;
};

export function useInfiniteScroll(
  loadMore: () => void | Promise<void>,
  hasMore: boolean,
  isLoading: boolean,
  options: UseInfiniteScrollOptions = {},
) {
  const { enabled = true, threshold = 0.1, rootMargin } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  useEffect(() => {
    if (!enabled) return;
    if (isLoading || !hasMore) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreRef.current();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasMore, isLoading, rootMargin, threshold]);

  return sentinelRef;
}
