import { useState, useCallback } from "react";
import type { PaginatedResponse } from "@/lib/pagination";

export interface FeedLoaderOptions<T> {
  initialItems: T[];
  initialCursor?: string;
  initialOffset?: number;
  initialHasMore: boolean;
  fetcher: (params: { cursor?: string; offset?: number }) => Promise<PaginatedResponse<T>>;
}

export interface FeedLoaderResult<T> {
  items: T[];
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  /** Reset to a new initial state (e.g. when tab changes) */
  reset: (newItems: T[], newCursor?: string, newOffset?: number, newHasMore?: boolean) => void;
}

/**
 * Generic feed loader hook.
 * Manages items / loading / hasMore / cursor / offset state.
 * Supports both cursor-based (new, tag) and offset-based (hot, rising, top) pagination.
 * Provides a stable `loadMore` for use with useInfiniteScroll or a button,
 * and a `reset` to reinitialise state on tab/sort change.
 */
export function useFeedLoader<T>({
  initialItems,
  initialCursor,
  initialOffset = 0,
  initialHasMore,
  fetcher,
}: FeedLoaderOptions<T>): FeedLoaderResult<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState<string | undefined>(initialCursor);
  const [offset, setOffset] = useState(initialOffset);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    try {
      const result = await fetcher({ cursor, offset });
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      if (result.nextCursor !== undefined) {
        setCursor(result.nextCursor);
      }
      if (result.nextOffset !== undefined) {
        setOffset(result.nextOffset);
      } else {
        setOffset((prev) => prev + result.items.length);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cursor, fetcher, hasMore, isLoading, offset]);

  const reset = useCallback(
    (newItems: T[], newCursor?: string, newOffset = 0, newHasMore = false) => {
      setItems(newItems);
      setCursor(newCursor);
      setOffset(newOffset);
      setHasMore(newHasMore);
    },
    [],
  );

  return { items, isLoading, hasMore, loadMore, reset };
}
