/**
 * Pagination utilities for posts feed
 * 
 * Supports two modes:
 * 1. Offset-based: for cached sorts (hot/rising) with page numbers
 * 2. Cursor-based: for time-based sorts (new/top) with ISO date cursor
 */

export interface PaginationParams {
  limit: number;
  offset?: number;
  cursor?: string; // ISO date string for time-based pagination
}

export interface PaginationResult<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
  nextOffset?: number;
}

/**
 * Build query params for /api/posts
 */
export function buildPostsQueryParams(options: {
  board?: string;
  tag?: string;
  author?: string;
  sort?: string;
  timeRange?: string;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  
  if (options.board) params.append('board', options.board);
  if (options.tag) params.append('tag', options.tag);
  if (options.author) params.append('author', options.author);
  if (options.sort) params.append('sort', options.sort);
  if (options.timeRange) params.append('t', options.timeRange);
  if (options.includeArchived) params.append('includeArchived', 'true');
  if (options.limit) params.append('limit', options.limit.toString());
  
  // Use cursor for tag feeds (time-based)
  if (options.cursor) {
    params.append('cursor', options.cursor);
  }
  // Use offset for board feeds (cached rankings)
  else if (options.offset !== undefined) {
    params.append('cursor', options.offset.toString());
  }
  
  return params;
}

/**
 * Get cursor for next page from last item
 */
export function getNextCursor<T extends { created_at?: string; createdAt?: string }>(
  items: T[]
): string | undefined {
  const lastItem = items[items.length - 1];
  return lastItem?.created_at || lastItem?.createdAt;
}

/**
 * Calculate hasMore based on items count vs limit
 */
export function calculateHasMore(items: unknown[], limit: number): boolean {
  return items.length >= limit;
}

/**
 * Pagination mode detection
 */
export type PaginationMode = 'offset' | 'cursor';

export function getPaginationMode(sort: string, tagMode?: boolean): PaginationMode {
  // Tag feeds always use cursor (time-based)
  if (tagMode) return 'cursor';
  
  // Cached sorts use offset
  if (sort === 'hot' || sort === 'rising') return 'offset';
  
  // Time-based sorts use cursor
  return 'cursor';
}

/**
 * Hook helper for feed pagination state
 */
export interface FeedPaginationState {
  page: number;
  cursor?: string;
  hasMore: boolean;
  isLoading: boolean;
}

export function createInitialPaginationState(
  initialItems: unknown[],
  limit: number = 20
): FeedPaginationState {
  return {
    page: 1,
    hasMore: initialItems.length >= limit,
    isLoading: false,
  };
}

/**
 * Update pagination state after loading more items
 */
export function updatePaginationState<T extends { created_at?: string }>(
  state: FeedPaginationState,
  newItems: T[],
  limit: number,
  mode: PaginationMode
): FeedPaginationState {
  const hasMore = calculateHasMore(newItems, limit);
  
  if (mode === 'cursor') {
    return {
      ...state,
      cursor: getNextCursor(newItems),
      hasMore,
      isLoading: false,
    };
  }
  
  return {
    ...state,
    page: state.page + 1,
    hasMore,
    isLoading: false,
  };
}
