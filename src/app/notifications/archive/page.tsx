"use client";

import { useState } from "react";
import { MessageSquare, MoreHorizontal, Settings, ArrowUp, User, EyeOff, CheckCircle2, ChevronLeft, Loader2 } from "lucide-react";
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

const ARCHIVED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 101,
    type: "reply",
    user: "old_timer",
    community: "r/nostalgia",
    content: "remember when the internet was just text? 'Those were the days...'",
    time: "1w",
    isUnread: false,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=old",
  },
  {
    id: 102,
    type: "upvote",
    user: "history_buff",
    community: "r/history",
    content: "upvoted your post: 'The fall of Rome was inevitable.'",
    time: "2w",
    isUnread: false,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=history",
  },
  {
    id: 103,
    type: "mention",
    user: "archivist",
    community: "r/libraries",
    content: "mentioned you in 'Best practices for digital archiving'",
    time: "1m",
    isUnread: false,
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=library",
  },
];

const MAX_NOTIFICATIONS = 6;

export default function NotificationArchivePage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(ARCHIVED_NOTIFICATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    setIsLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const moreNotifications: NotificationItem[] = [
      {
        id: Date.now(),
        type: "reply",
        user: "ghost_of_past",
        community: "r/retro",
        content: "replied to your comment from 3 months ago.",
        time: "3m",
        isUnread: false,
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

  const hideNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="flex items-center gap-4 mb-4 px-2">
        <Link 
          href="/notifications" 
          className="btn btn-ghost btn-circle btn-sm"
          aria-label="Back to notifications"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-base-content">Archive</h1>
      </div>

      <div className="bg-base-100 rounded-lg overflow-hidden border border-neutral">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-[#818384]">
            <p>Your archive is empty.</p>
          </div>
        ) : (
          <>
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className="relative border-b border-neutral last:border-0 hover:bg-base-300 transition-colors"
              >
                <Link
                  href={`/notifications/${notif.id}`}
                  className="flex items-start gap-3 p-4 pr-12"
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
                      <span className="font-bold text-sm text-base-content">u/{notif.user}</span>
                      <span className="text-[#818384] text-sm">{notif.content}</span>
                      <span className="text-[#818384] text-sm">• {notif.time}</span>
                    </div>
                  </div>
                </Link>

                <div className="absolute right-3 top-4">
                  <div className="dropdown dropdown-end">
                    <button 
                      tabIndex={0}
                      className="btn btn-ghost btn-circle btn-xs"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="More options"
                    >
                      <MoreHorizontal size={16} className="text-[#818384]" />
                    </button>
                    <ul 
                      tabIndex={0} 
                      className="dropdown-content menu p-2 shadow-lg bg-base-100 border border-neutral rounded-box w-52 z-[1]"
                    >
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
                          <EyeOff size={16} /> Remove from archive
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
                No more archived notifications
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
