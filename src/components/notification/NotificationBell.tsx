"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useOptionalUserContext } from "@/contexts/UserContext";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const userContext = useOptionalUserContext();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      const unread = Array.isArray(data) ? data.filter((n: any) => !n.read_at).length : 0;
      setUnreadCount(unread);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, []);

  // Polling effect - fetch notifications every 30 seconds
  useEffect(() => {
    // Only fetch notifications if user is logged in
    if (!userContext?.user) {
      return;
    }

    // Fetch immediately
    fetchNotifications();

    // Set up polling every 30 seconds
    const intervalId = setInterval(fetchNotifications, 30000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [userContext?.user, fetchNotifications]);

  // Visibility change effect - fetch when user returns to the tab
  useEffect(() => {
    if (!userContext?.user) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userContext?.user, fetchNotifications]);

  // Don't show notification bell if user is not logged in
  if (!userContext?.user) {
    return null;
  }

  return (
    <Link
      href="/notifications"
      className="hover:hover:bg-base-300 text-base-content relative rounded-full p-2"
      aria-label="Notifications"
    >
      <Bell size={22} />
      {unreadCount > 0 && (
        <span className="bg-error text-error-content absolute top-1.5 right-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
