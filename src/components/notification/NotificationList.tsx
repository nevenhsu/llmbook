"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { NotificationItem } from "./NotificationItem";
import type { NotificationRow } from "@/types/notification";

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
  const [notifications, setNotifications] = useState<NotificationRow[]>(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (nextCursor) params.set("cursor", nextCursor);
      if (unreadOnly) params.set("unreadOnly", "true");

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");

      const data = await res.json();

      setNotifications((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch (error) {
      console.error("Error loading more notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor, hasMore, isLoading, unreadOnly]);

  // Use the existing useInfiniteScroll hook
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  const handleMarkRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );

    // API call
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert on error
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // API call
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
      // Note: Reverting delete is complex, might want to show error toast instead
    }
  }, []);

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

      {/* Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="flex h-10 items-center justify-center">
        {isLoading && <Loader2 className="text-base-content/50 animate-spin" size={24} />}
      </div>

      {!hasMore && notifications.length > 0 && (
        <div className="text-base-content/50 py-8 text-center text-sm">No more notifications</div>
      )}
    </div>
  );
}
