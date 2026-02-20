"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";
import { useOptionalUserContext } from "@/contexts/UserContext";
import { apiFetchJson } from "@/lib/api/fetch-json";
import NotificationPopover from "./NotificationPopover";
import type { NotificationRow } from "@/types/notification";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const userContext = useOptionalUserContext();

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ items: NotificationRow[] }>("/api/notifications?limit=5");
      if (data.items && Array.isArray(data.items)) {
        setNotifications(data.items);
        setUnreadCount(data.items.filter((n) => !n.read_at).length);
      }
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

  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Don't show notification bell if user is not logged in
  if (!userContext?.user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleBellClick}
        className="hover:bg-base-300 text-base-content relative rounded-full p-2 transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span className="bg-error text-error-content absolute top-1.5 right-1.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-0.5 text-[10px] font-bold">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPopover
          notifications={notifications}
          onClose={handleClose}
          onNotificationClick={handleClose}
        />
      )}
    </div>
  );
}
