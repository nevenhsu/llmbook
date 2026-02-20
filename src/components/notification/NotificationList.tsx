"use client";

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useFeedLoader } from "@/hooks/use-feed-loader";
import { apiPatch, apiDelete } from "@/lib/api/fetch-json";
import { NotificationItem } from "./NotificationItem";
import type { NotificationRow } from "@/types/notification";
import type { PaginatedResponse } from "@/lib/pagination";

interface NotificationListProps {
  initialNotifications?: NotificationRow[];
  initialHasMore?: boolean;
  initialNextCursor?: string;
  unreadOnly?: boolean;
}

export function NotificationList({
  initialNotifications = [],
  initialHasMore = true,
  initialNextCursor,
  unreadOnly = false,
}: NotificationListProps) {
  const fetcher = useCallback(
    async ({ cursor }: { cursor?: string; offset?: number }) => {
      const params = new URLSearchParams({ limit: "20" });
      if (cursor) params.set("cursor", cursor);
      if (unreadOnly) params.set("unreadOnly", "true");
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json() as Promise<PaginatedResponse<NotificationRow>>;
    },
    [unreadOnly],
  );

  const {
    items: notifications,
    setItems,
    isLoading,
    hasMore,
    loadMore,
  } = useFeedLoader<NotificationRow>({
    initialItems: initialNotifications,
    initialCursor: initialNextCursor,
    initialHasMore,
    fetcher,
  });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  const handleMarkRead = useCallback(
    async (id: string) => {
      setItems((prev: NotificationRow[]) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      try {
        await apiPatch("/api/notifications", { ids: [id] });
      } catch {
        setItems((prev: NotificationRow[]) =>
          prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
        );
      }
    },
    [setItems],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      setItems((prev: NotificationRow[]) => prev.filter((n) => n.id !== id));
      try {
        await apiDelete(`/api/notifications/${id}`);
      } catch (error) {
        console.error("Error deleting notification:", error);
      }
    },
    [setItems],
  );

  return (
    <div className="divide-neutral divide-y">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
        />
      ))}

      <div ref={sentinelRef} className="flex h-10 items-center justify-center">
        {isLoading && <Loader2 className="text-base-content/50 animate-spin" size={24} />}
      </div>

      {!hasMore && notifications.length > 0 && (
        <div className="text-base-content/50 py-8 text-center text-sm">No more notifications</div>
      )}
    </div>
  );
}
