"use client";

import { useState } from "react";
import {
  MessageSquare,
  MoreHorizontal,
  Settings,
  ArrowUp,
  User,
  EyeOff,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface NotificationItem {
  id: number;
  type: "reply" | "upvote" | "mention";
  user: string;
  community: string;
  content: string;
  time: string;
  isUnread: boolean;
  avatar: string;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    type: "reply",
    user: "tech_enthusiast",
    community: "r/technology",
    content:
      "replied to your comment: 'I think the new AI models are going to change everything...'",
    time: "2h",
    isUnread: true,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=tech",
  },
  {
    id: 2,
    type: "upvote",
    user: "design_pro",
    community: "r/design",
    content: "upvoted your post: 'Check out this new UI kit I made!'",
    time: "5h",
    isUnread: true,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=design",
  },
  {
    id: 3,
    type: "mention",
    user: "moderator_bot",
    community: "r/announcements",
    content: "mentioned you in a comment in 'Welcome to the new community!'",
    time: "1d",
    isUnread: false,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=bot",
  },
  {
    id: 4,
    type: "reply",
    user: "coffee_lover",
    community: "r/coffee",
    content:
      "replied to your comment: 'The V60 is definitely better for light roasts.'",
    time: "2d",
    isUnread: false,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=coffee",
  },
];

const MAX_NOTIFICATIONS = 8;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    INITIAL_NOTIFICATIONS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, isUnread: false })));
  };

  const markAsRead = (id: number) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, isUnread: false } : n)),
    );
  };

  const hideNotification = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const loadMore = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const moreNotifications: NotificationItem[] = [
      {
        id: Date.now(),
        type: "reply",
        user: "new_user_" + Math.floor(Math.random() * 100),
        community: "r/nextjs",
        content: "replied to your comment: 'This is looking great!'",
        time: "just now",
        isUnread: true,
        avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${Date.now()}`,
      }
    ];

    setNotifications((prev) => {
      const next = [...prev, ...moreNotifications];
      if (next.length >= MAX_NOTIFICATIONS) {
        setHasMore(false);
      }
      return next;
    });
    
    setIsLoading(false);
  };

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="flex items-center justify-between mb-4 px-2">
        <h1 className="text-2xl font-bold text-base-content">Notifications</h1>
        <div className="flex items-center gap-2">
          {/* Top-right Settings Dropdown */}
          <div className="dropdown dropdown-end">
            <button
              tabIndex={0}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Notification Settings"
            >
              <Settings size={20} className="text-[#818384]" />
            </button>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 border border-neutral rounded-box w-56 z-[10]"
            >
              <li>
                <button
                  onClick={() => {
                    markAllAsRead();
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}
                  className="flex items-center gap-2 py-2"
                >
                  <CheckCircle2 size={16} /> Mark all as read
                </button>
              </li>
              <li>
                <Link
                  href="/settings/notifications"
                  className="flex items-center gap-2 py-2"
                >
                  <Settings size={16} /> Notification settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-base-100 rounded-lg overflow-hidden border border-neutral">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-[#818384]">
            <p>No notifications yet.</p>
          </div>
        ) : (
          <>
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`relative border-b border-neutral last:border-0 hover:bg-base-300 transition-colors ${
                  notif.isUnread ? "bg-primary/5" : ""
                }`}
              >
                <Link
                  href={`/notifications/${notif.id}`}
                  className="flex items-start gap-3 p-4 pr-12"
                  aria-label={`Notification from ${notif.user} in ${notif.community}: ${notif.content}`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-base-200 relative">
                      <Image
                        src={notif.avatar}
                        alt={`${notif.user}'s avatar`}
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-base-100 rounded-full p-0.5">
                      {notif.type === "upvote" ? (
                        <div className="bg-[#FF4500] text-white rounded-full p-0.5">
                          <ArrowUp size={10} strokeWidth={4} />
                        </div>
                      ) : notif.type === "reply" ? (
                        <div className="bg-blue-500 text-white rounded-full p-0.5">
                          <MessageSquare size={10} fill="currentColor" />
                        </div>
                      ) : (
                        <div className="bg-gray-500 text-white rounded-full p-0.5">
                          <User size={10} fill="currentColor" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-sm text-base-content hover:underline">
                        u/{notif.user}
                      </span>
                      <span className="text-[#818384] text-sm">
                        {notif.content}
                      </span>
                      <span className="text-[#818384] text-sm">
                        • {notif.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {notif.isUnread && (
                      <div
                        className="h-2 w-2 rounded-full bg-primary"
                        aria-label="Unread notification"
                      ></div>
                    )}
                  </div>
                </Link>

                {/* Dropdown Menu - Moved outside Link to fix event propagation */}
                <div className="absolute right-3 top-4">
                  <div className="dropdown dropdown-end">
                    <button
                      tabIndex={0}
                      className="btn btn-ghost btn-circle btn-xs"
                      onClick={(e) => {
                        // These help open the dropdown without triggering the Link
                        e.stopPropagation();
                      }}
                      aria-label="More options"
                    >
                      <MoreHorizontal size={16} className="text-[#818384]" />
                    </button>
                    <ul
                      tabIndex={0}
                      className="dropdown-content menu p-2 shadow-lg bg-base-100 border border-neutral rounded-box w-52 z-[11]"
                    >
                      {notif.isUnread && (
                        <li>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAsRead(notif.id);
                              // Close dropdown by blurring active element
                              if (document.activeElement instanceof HTMLElement) {
                                document.activeElement.blur();
                              }
                            }}
                            className="flex items-center gap-2 py-2"
                          >
                            <CheckCircle2 size={16} /> Mark as read
                          </button>
                        </li>
                      )}
                      <li>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            hideNotification(notif.id);
                            if (document.activeElement instanceof HTMLElement) {
                              document.activeElement.blur();
                            }
                          }}
                          className="flex items-center gap-2 py-2"
                        >
                          <EyeOff size={16} /> Hide notification
                        </button>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ))}
            
            {hasMore ? (
              <div className="p-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="btn btn-primary btn-sm rounded-full px-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            ) : (
              <div className="p-4 text-center text-[#818384] text-sm border-t border-neutral/50">
                No more notifications to load
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 text-center text-[#818384] text-sm">
        <p>
          Looking for older notifications? Check out your{" "}
          <Link
            href="/notifications/archive"
            className="text-primary hover:underline"
          >
            archive
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
