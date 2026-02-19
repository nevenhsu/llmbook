"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { UserListItem } from "@/types/user";

interface UseUserListOptions {
  userId: string | null;
  type: "followers" | "following";
  limit?: number;
}

interface UseUserListReturn {
  users: UserListItem[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadMore: () => Promise<void>;
  reset: () => void;
  retry: () => void;
}

/**
 * Shared hook for followers/following lists with search and infinite scroll
 *
 * Features:
 * - Debounced search (300ms)
 * - Request cancellation (AbortController)
 * - Race condition prevention
 * - Error handling with retry
 * - Infinite scroll support
 *
 * @example
 * ```tsx
 * const { users, isLoading, searchQuery, setSearchQuery, loadMore } = useUserList({
 *   userId: "123",
 *   type: "followers"
 * });
 * ```
 */
export function useUserList({ userId, type, limit = 20 }: UseUserListOptions): UseUserListReturn {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Track AbortController for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track last fetch parameters to prevent duplicate requests
  const lastFetchRef = useRef<string>("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Shared fetch logic with AbortController
  const fetchUsers = useCallback(
    async (cursor?: string, isLoadingMoreData = false) => {
      if (!userId) return;

      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Build fetch parameters
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", limit.toString());

      const endpoint = `/api/users/${userId}/${type}`;
      const url = `${endpoint}?${params.toString()}`;

      // Prevent duplicate requests
      const fetchKey = `${url}`;
      if (fetchKey === lastFetchRef.current && !cursor) {
        console.debug(`[useUserList] Skipping duplicate request:`, fetchKey);
        return;
      }
      lastFetchRef.current = fetchKey;

      // Set loading state
      if (isLoadingMoreData) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        console.debug(`[useUserList] Fetching ${type}:`, {
          searchQuery: debouncedSearch,
          cursor,
          url,
        });

        const res = await fetch(url, { signal: abortController.signal });

        if (!res.ok) {
          throw new Error(`Failed to fetch ${type}: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();

        // Only update if request wasn't aborted
        if (!abortController.signal.aborted) {
          if (isLoadingMoreData) {
            setUsers((prev) => [...prev, ...data.items]);
          } else {
            setUsers(data.items);
          }
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === "AbortError") {
          console.debug(`[useUserList] Request aborted:`, url);
          return;
        }

        console.error(`[useUserList] Error loading ${type}:`, err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    [userId, type, debouncedSearch, limit],
  );

  // Load more users (pagination)
  const loadMore = useCallback(async () => {
    if (isLoading || isLoadingMore || !hasMore || !userId) return;
    await fetchUsers(nextCursor, true);
  }, [fetchUsers, nextCursor, hasMore, isLoading, isLoadingMore, userId]);

  // Reset function for manual resets
  const reset = useCallback(() => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setUsers([]);
    setNextCursor(undefined);
    setHasMore(true);
    setSearchQuery("");
    setDebouncedSearch("");
    setError(null);
    lastFetchRef.current = "";
  }, []);

  // Retry last failed request
  const retry = useCallback(() => {
    if (users.length === 0) {
      fetchUsers();
    } else {
      loadMore();
    }
  }, [users.length, fetchUsers, loadMore]);

  // Reset list and fetch when search changes or userId changes
  useEffect(() => {
    if (!userId) return;

    // Reset state
    setUsers([]);
    setNextCursor(undefined);
    setHasMore(true);
    lastFetchRef.current = "";

    // Fetch with new search term (after debounce)
    fetchUsers();

    // Cleanup: cancel request on unmount or when dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearch, userId, type, fetchUsers]);

  return {
    users,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    reset,
    retry,
  };
}
