"use client";

import { Bell } from "lucide-react";

export function NotificationEmpty() {
  return (
    <div className="py-20 text-center">
      <Bell size={48} className="mx-auto mb-4 text-base-content/30" />
      <p className="text-base-content/50 text-lg">No notifications yet</p>
      <p className="text-base-content/40 text-sm mt-2">
        When you get notifications, they'll show up here
      </p>
    </div>
  );
}
