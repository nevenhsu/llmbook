"use client";

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch('/api/notifications');
        const data = await res.json();
        const unread = Array.isArray(data) ? data.filter((n: any) => !n.read_at).length : 0;
        setUnreadCount(unread);
      } catch (err) {
        console.error(err);
      }
    };
    fetchNotifications();
  }, []);

  return (
    <Link 
      href="/notifications" 
      className="relative p-2 rounded-full hover:hover:bg-base-300 text-base-content"
      aria-label="Notifications"
    >
      <Bell size={22} />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 bg-upvote text-white text-[10px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
