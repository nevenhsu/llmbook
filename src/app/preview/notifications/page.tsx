"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, RefreshCw, Bell } from "lucide-react";
import { NotificationItem } from "@/components/notification/NotificationItem";
import { NotificationEmpty } from "@/components/notification/NotificationEmpty";
import { MOCK_NOTIFICATIONS, getMockNotifications, getRecentMockNotifications } from "./mock-data";
import type { NotificationRow } from "@/types/notification";

export default function NotificationsPreviewPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>(() => {
    const { items } = getMockNotifications(undefined, 10);
    return items;
  });
  const [showEmpty, setShowEmpty] = useState(false);
  const [showBellPreview, setShowBellPreview] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const recentNotifications = getRecentMockNotifications(5);
  const bellUnreadCount = recentNotifications.filter((n) => !n.read_at).length;

  // 模擬標記已讀
  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }, []);

  // 模擬刪除
  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 模擬全部標記已讀
  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })),
    );
  };

  // 重置為初始狀態
  const handleReset = () => {
    const { items } = getMockNotifications(undefined, 10);
    setNotifications(items);
    setShowEmpty(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications Preview</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="btn btn-ghost btn-sm gap-2"
            title="Reset to initial state"
          >
            <RefreshCw size={16} />
            Reset
          </button>
        </div>
      </div>

      {/* Preview Controls */}
      <div className="bg-base-200 border-neutral mb-4 rounded-lg border p-4">
        <h2 className="text-base-content/70 mb-2 text-sm font-bold tracking-wider uppercase">
          Preview Controls
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmpty(!showEmpty)}
            className={`btn btn-sm ${showEmpty ? "btn-primary" : "btn-outline"}`}
          >
            {showEmpty ? "Show Notifications" : "Show Empty State"}
          </button>
          <button
            onClick={() => setShowBellPreview(!showBellPreview)}
            className={`btn btn-sm ${showBellPreview ? "btn-primary" : "btn-outline"}`}
          >
            {showBellPreview ? "Hide Bell Dropdown" : "Show Bell Dropdown"}
          </button>
          <button onClick={handleMarkAllRead} className="btn btn-outline btn-sm">
            Mark All Read
          </button>
        </div>
      </div>

      {/* NotificationBell Dropdown Preview */}
      {showBellPreview && (
        <div className="bg-base-200 border-neutral mb-4 rounded-lg border p-4">
          <h2 className="text-base-content/70 mb-3 text-sm font-bold tracking-wider uppercase">
            NotificationBell Dropdown Preview
          </h2>
          <div className="bg-base-100 border-neutral max-w-md rounded-lg border shadow-lg">
            {/* Bell Icon Header (mock) */}
            <div className="border-neutral flex items-center justify-between border-b p-3">
              <div className="flex items-center gap-2">
                <Bell size={20} className="text-base-content/70" />
                <span className="text-sm font-semibold">Recent Notifications</span>
              </div>
              {bellUnreadCount > 0 && (
                <span className="badge badge-sm bg-error text-white">{bellUnreadCount}</span>
              )}
            </div>

            {/* Recent Notifications List */}
            <div className="divide-neutral divide-y">
              {recentNotifications.length === 0 ? (
                <div className="p-6 text-center">
                  <Bell size={32} className="text-base-content/30 mx-auto mb-2" />
                  <p className="text-base-content/50 text-sm">No notifications</p>
                </div>
              ) : (
                recentNotifications.map((notification) => (
                  <NotificationItemPreview
                    key={notification.id}
                    notification={notification}
                    compact
                  />
                ))
              )}
            </div>

            {/* Footer - View All Link */}
            <div className="border-neutral border-t p-3">
              <button
                className="text-base-content/70 hover:text-base-content w-full text-center text-sm font-medium"
                onClick={() => alert("Would navigate to /notifications")}
              >
                View all notifications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-3">
          <span className="text-base-content border-base-content/30 border-b-2 pb-2 text-sm font-bold">
            All ({notifications.length})
          </span>
          {unreadCount > 0 && (
            <span className="text-base-content/70 pb-2 text-sm">Unread ({unreadCount})</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-base-content/70 hover:text-base-content flex items-center gap-2 text-sm"
          >
            <CheckCircle2 size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Main Content */}
      {showEmpty ? (
        <NotificationEmpty />
      ) : (
        <div className="divide-neutral border-neutral divide-y rounded-lg border">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Type Reference */}
      <div className="bg-base-200 border-neutral mt-8 rounded-lg border p-4">
        <h2 className="text-base-content/70 mb-2 text-sm font-bold tracking-wider uppercase">
          Notification Types in Preview
        </h2>
        <ul className="text-base-content/70 space-y-1 text-sm">
          <li>✅ post_upvote - Post received upvote (with/without milestone)</li>
          <li>✅ comment_upvote - Comment received upvote (with/without milestone)</li>
          <li>✅ comment_reply - New comment on your post</li>
          <li>✅ comment_reply_to_comment - Reply to your comment</li>
          <li>✅ mention - Someone mentioned you (in post or comment)</li>
          <li>✅ new_follower - New follower</li>
          <li>✅ followed_user_post - Followed user posted</li>
        </ul>
      </div>
    </div>
  );
}

// Simplified NotificationItem for compact dropdown display
function NotificationItemPreview({
  notification,
  compact = false,
}: {
  notification: NotificationRow;
  compact?: boolean;
}) {
  const {
    getNotificationMessage,
    getNotificationLink,
    getNotificationIconType,
  } = require("@/types/notification");
  const Timestamp = require("@/components/ui/Timestamp").default;
  const { ArrowUp, Reply, AtSign, UserPlus, FileText, MessageSquare } = require("lucide-react");

  const link = getNotificationLink(notification);
  const message = getNotificationMessage(notification);
  const iconType = getNotificationIconType(notification.type);

  const iconProps = { size: compact ? 16 : 20 };
  let icon;

  switch (iconType) {
    case "upvote":
      icon = <ArrowUp {...iconProps} className="text-success" />;
      break;
    case "reply":
      icon = <Reply {...iconProps} className="text-blue-500" />;
      break;
    case "mention":
      icon = <AtSign {...iconProps} className="text-accent" />;
      break;
    case "follow":
      icon = <UserPlus {...iconProps} className="text-primary" />;
      break;
    case "post":
      icon = <FileText {...iconProps} className="text-accent" />;
      break;
    default:
      icon = <MessageSquare {...iconProps} className="text-base-content/70" />;
  }

  const content = (
    <div
      className={`group hover:bg-base-200 flex items-start gap-3 transition-colors ${
        compact ? "p-3" : "p-4"
      } ${!notification.read_at ? "bg-base-200/50" : ""}`}
    >
      <div className="mt-1 flex-shrink-0">{icon}</div>

      <div className="min-w-0 flex-1">
        <p className={`text-base-content break-words ${compact ? "text-xs" : "text-sm"}`}>
          {message}
        </p>
        <Timestamp
          date={notification.created_at}
          className={`text-base-content/50 mt-1 ${compact ? "text-[10px]" : "text-xs"}`}
        />
      </div>

      {!notification.read_at && (
        <div className="flex-shrink-0">
          <div className="bg-error h-2 w-2 rounded-full"></div>
        </div>
      )}
    </div>
  );

  // In preview mode, clicking shows an alert instead of navigating
  if (link) {
    return (
      <div onClick={() => alert(`Would navigate to: ${link}`)} className="cursor-pointer">
        {content}
      </div>
    );
  }

  return content;
}
