"use client";

import { useEffect, useState, useCallback } from "react";
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
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  loadMore: () => Promise<void>;
  reset: () => void;
}

/**
 * Shared hook for followers/following lists with search and infinite scroll
 */
export function useUserList({
  userId,
  type,
  limit = 20,
}: UseUserListOptions): UseUserListReturn {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset list when search changes or userId changes
  useEffect(() => {
    if (userId) {
      setUsers([]);
      setNextCursor(undefined);
      setHasMore(true);
    }
  }, [debouncedSearch, userId]);

  // Load more users
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || !userId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextCursor) params.set("cursor", nextCursor);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("limit", limit.toString());

      const endpoint = `/api/users/${userId}/${type}`;
      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed to fetch ${type}`);

      const data = await res.json();

      setUsers((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, type, nextCursor, hasMore, isLoading, debouncedSearch, limit]);

  // Reset function for manual resets
  const reset = useCallback(() => {
    setUsers([]);
    setNextCursor(undefined);
    setHasMore(true);
    setSearchQuery("");
    setDebouncedSearch("");
  }, []);

  // Initial load
  useEffect(() => {
    if (userId && users.length === 0 && !isLoading) {
      loadMore();
    }
  }, [userId, users.length, isLoading, loadMore]);

  return {
    users,
    hasMore,
    isLoading,
    searchQuery,
    setSearchQuery,
    loadMore,
    reset,
  };
}
