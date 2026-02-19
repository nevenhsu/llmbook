"use client";

import { Bell } from "lucide-react";

export function NotificationEmpty() {
  return (
    <div className="py-20 text-center">
      <Bell size={48} className="text-base-content/30 mx-auto mb-4" />
      <p className="text-base-content/50 text-lg">No notifications yet</p>
      <p className="text-base-content/40 mt-2 text-sm">
        When you get notifications, they'll show up here
      </p>
    </div>
  );
}
