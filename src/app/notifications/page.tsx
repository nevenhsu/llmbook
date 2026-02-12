"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Settings,
  ArrowUp,
  User,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Timestamp from "@/components/ui/Timestamp";

interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  related_id: string | null;
  related_type: string | null;
  created_at: string;
  read_at: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications
      .filter(n => !n.read_at)
      .map(n => n.id);
    
    if (unreadIds.length === 0) return;

    setIsMarkingRead(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unreadIds })
      });

      if (!res.ok) throw new Error('Failed to mark as read');

      setNotifications(notifications.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id] })
      });

      if (!res.ok) throw new Error('Failed to mark as read');

      setNotifications(
        notifications.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'comment_reply':
        return <MessageSquare size={20} className="text-blue-500" />;
      case 'post_upvote':
      case 'comment_upvote':
        return <ArrowUp size={20} className="text-upvote" />;
      case 'mention':
        return <User size={20} className="text-purple-500" />;
      default:
        return <MessageSquare size={20} className="text-base-content/70" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 sm:pb-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Link
          href="/settings/notifications"
          className="flex items-center gap-2 text-sm text-base-content/70 hover:text-base-content"
        >
          <Settings size={18} />
          Settings
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral">
        <div className="flex items-center gap-3">
          <Link
            href="/notifications"
            className="text-sm font-bold text-base-content border-b-2 border-upvote pb-2"
          >
            All ({notifications.length})
          </Link>
          {unreadCount > 0 && (
            <Link
              href="/notifications"
              className="text-sm text-base-content/70 hover:text-base-content pb-2"
            >
              Unread ({unreadCount})
            </Link>
          )}
          <Link
            href="/notifications/archive"
            className="text-sm text-base-content/70 hover:text-base-content pb-2"
          >
            Archive
          </Link>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={isMarkingRead}
            className="flex items-center gap-2 text-sm text-upvote hover:underline"
          >
            {isMarkingRead ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-base-content/50" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-base-content/50">
          <p>No notifications yet</p>
        </div>
      ) : (
        <div className="divide-y divide-neutral">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-start gap-3 p-4 hover:bg-base-200 transition-colors ${
                !notification.read_at ? 'bg-base-200/50' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-1">{getIcon(notification.type)}</div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-base-content break-words">
                  {notification.content}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-base-content/50">
                  <Timestamp date={notification.created_at} />
                </div>
              </div>

              {!notification.read_at && (
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="flex-shrink-0 text-xs text-upvote hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
