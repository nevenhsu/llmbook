"use client";

import Link from "next/link";
import { Trash2, ArrowUp, Reply, AtSign, UserPlus, FileText, MessageSquare } from "lucide-react";
import Timestamp from "@/components/ui/Timestamp";
import type { NotificationRow } from "@/types/notification";
import {
  getNotificationMessage,
  getNotificationLink,
  getNotificationIconType,
  NOTIFICATION_TYPES,
} from "@/types/notification";

interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationIcon({ type }: { type: string }) {
  const iconType = getNotificationIconType(type as any);
  const iconProps = { size: 20 };

  switch (iconType) {
    case "upvote":
      return <ArrowUp {...iconProps} className="text-success" />;
    case "reply":
      return <Reply {...iconProps} className="text-blue-500" />;
    case "mention":
      return <AtSign {...iconProps} className="text-accent" />;
    case "follow":
      return <UserPlus {...iconProps} className="text-primary" />;
    case "post":
      return <FileText {...iconProps} className="text-accent" />;
    default:
      return <MessageSquare {...iconProps} className="text-base-content/70" />;
  }
}

export function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const link = getNotificationLink(notification);
  const message = getNotificationMessage(notification);

  const handleMarkRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMarkRead(notification.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(notification.id);
  };

  const handleClick = (e: React.MouseEvent) => {
    // If clicking on a button, don't navigate
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }

    // Auto mark as read when clicking
    if (!notification.read_at) {
      onMarkRead(notification.id);
    }
  };

  const content = (
    <div
      className={`group hover:bg-base-200 flex items-start gap-3 p-4 transition-colors ${
        !notification.read_at ? "bg-base-200/50" : ""
      }`}
    >
      {/* Icon */}
      <div className="mt-1 flex-shrink-0">
        <NotificationIcon type={notification.type} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-sm break-words">{message}</p>
        <Timestamp date={notification.created_at} className="mt-1" />
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-2">
        {!notification.read_at && (
          <button
            onClick={handleMarkRead}
            className="text-base-content/70 hover:text-base-content text-xs"
          >
            Mark read
          </button>
        )}
        <button
          onClick={handleDelete}
          className="text-error hover:text-error/80 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label="Delete notification"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  // If no link, render as div
  if (!link) {
    return <div>{content}</div>;
  }

  // Otherwise, render as Link
  return (
    <Link href={link} onClick={handleClick} className="block no-underline hover:no-underline">
      {content}
    </Link>
  );
}
