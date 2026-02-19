"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  getNotificationIconType,
  getNotificationMessage,
  getNotificationLink,
} from "@/types/notification";
import Timestamp from "@/components/ui/Timestamp";
import { ArrowBigUp, MessageSquare, AtSign, UserPlus, FileText, MessageCircle } from "lucide-react";
import type { NotificationRow } from "@/types/notification";

interface NotificationPopoverProps {
  notifications: NotificationRow[];
  onClose: () => void;
  onNotificationClick: () => void;
}

const iconMap: Record<string, React.ReactElement> = {
  upvote: <ArrowBigUp size={18} className="text-success" />,
  comment: <MessageSquare size={18} className="text-accent" />,
  reply: <MessageCircle size={18} className="text-accent" />,
  mention: <AtSign size={18} className="text-accent" />,
  follow: <UserPlus size={18} className="text-primary" />,
  post: <FileText size={18} className="text-accent" />,
  default: <FileText size={18} className="text-base-content/50" />,
};

export default function NotificationPopover({
  notifications,
  onClose,
  onNotificationClick,
}: NotificationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="border-neutral bg-base-100 absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border shadow-xl"
    >
      {/* Header */}
      <div className="border-neutral border-b px-4 py-3">
        <h3 className="text-base-content font-bold">Notifications</h3>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-base-content/50 px-4 py-8 text-center text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => {
            const link = getNotificationLink(notification);
            const message = getNotificationMessage(notification);
            const iconType = getNotificationIconType(notification.type);
            const icon = iconMap[iconType] || iconMap.default;

            const content = (
              <div
                className={`hover:bg-base-200 flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${
                  !notification.read_at ? "bg-base-200/50" : ""
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">{icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-base-content line-clamp-2 text-sm">{message}</p>
                  <Timestamp
                    date={notification.created_at}
                    className="text-base-content/50 mt-1 text-xs"
                  />
                </div>
              </div>
            );

            if (link) {
              return (
                <Link
                  key={notification.id}
                  href={link}
                  onClick={onNotificationClick}
                  className="no-underline hover:no-underline"
                >
                  {content}
                </Link>
              );
            }

            return <div key={notification.id}>{content}</div>;
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-neutral border-t px-4 py-3">
        <Link
          href="/notifications"
          onClick={onNotificationClick}
          className="text-base-content/70 hover:text-base-content text-sm no-underline hover:no-underline"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
