"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { NotificationList } from "@/components/notification/NotificationList";
import { NotificationEmpty } from "@/components/notification/NotificationEmpty";
import type { NotificationRow } from "@/types/notification";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (activeTab === "unread") params.set("unreadOnly", "true");

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");

      const data = await res.json();

      setNotifications(data.items || []);
      setHasMore(data.hasMore ?? false);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setIsMarkingAllRead(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: unreadIds }),
      });

      if (!res.ok) throw new Error("Failed to mark as read");

      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error("Failed to mark as read:", err);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
      </div>

      {/* Tabs */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "pb-2 text-sm font-bold",
              activeTab === "all"
                ? "text-base-content border-upvote border-b-2"
                : "text-base-content/70 hover:text-base-content",
            )}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("unread")}
            className={cn(
              "pb-2 text-sm",
              activeTab === "unread"
                ? "text-base-content border-upvote border-b-2 font-bold"
                : "text-base-content/70 hover:text-base-content",
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={isMarkingAllRead}
            className="flex items-center gap-2 text-sm hover:underline disabled:opacity-50"
          >
            {isMarkingAllRead ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-base-content/50 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <NotificationEmpty />
      ) : (
        <NotificationList
          initialNotifications={notifications}
          initialHasMore={hasMore}
          initialNextCursor={nextCursor}
          unreadOnly={activeTab === "unread"}
        />
      )}
    </div>
  );
}
