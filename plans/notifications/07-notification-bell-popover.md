# 07 - NotificationBell Popover

> **目標：** 將 NotificationBell 從直接跳轉改為顯示 Popover 預覽，顯示最近 5 筆通知。

---

## 1. 功能規格

### 1.1 行為變更

| 現狀 | 新行為 |
|------|--------|
| 點擊鈴鐺 → 跳轉 `/notifications` | 點擊鈴鐺 → 顯示 Popover |

### 1.2 Popover 內容

- 顯示最近 **5 筆**通知（不限已讀/未讀）
- 每筆通知顯示：圖標、訊息、時間
- 點擊通知 → 跳轉到相關內容 + 關閉 Popover
- 底部有「View all notifications」連結 → 跳轉 `/notifications`
- 點擊外部 → 關閉 Popover

---

## 2. 元件結構

### 2.1 更新 NotificationBell

**修改 `src/components/notification/NotificationBell.tsx`：**

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useOptionalUserContext } from "@/contexts/UserContext";
import NotificationPopover from "./NotificationPopover";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const userContext = useOptionalUserContext();
  const bellRef = useRef<HTMLButtonElement>(null);

  // ... 現有的 fetchNotifications 邏輯 ...

  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!userContext?.user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={handleBellClick}
        className="hover:bg-base-300 text-base-content relative rounded-full p-2"
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
          notifications={notifications.slice(0, 5)}
          onClose={handleClose}
          onNotificationClick={handleClose}
        />
      )}
    </div>
  );
}
```

### 2.2 新增 NotificationPopover 元件

**建立 `src/components/notification/NotificationPopover.tsx`：**

```tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { getNotificationIcon, getNotificationMessage, getNotificationLink } from "@/types/notification";
import Timestamp from "@/components/ui/Timestamp";
import type { NotificationRow } from "@/types/notification";

interface NotificationPopoverProps {
  notifications: NotificationRow[];
  onClose: () => void;
  onNotificationClick: () => void;
}

export default function NotificationPopover({
  notifications,
  onClose,
  onNotificationClick,
}: NotificationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // ESC 關閉
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
      className="absolute right-0 top-full mt-2 w-80 bg-base-100 border border-neutral rounded-lg shadow-xl z-50"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral">
        <h3 className="font-bold text-base-content">Notifications</h3>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-base-content/50 text-sm">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => {
            const link = getNotificationLink(notification);
            const message = getNotificationMessage(notification);
            const icon = getNotificationIcon(notification.type);

            const content = (
              <div
                className={`flex items-start gap-3 px-4 py-3 hover:bg-base-200 transition-colors cursor-pointer ${
                  !notification.read_at ? "bg-base-200/50" : ""
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-base-content line-clamp-2">{message}</p>
                  <Timestamp date={notification.created_at} className="text-xs text-base-content/50 mt-1" />
                </div>
              </div>
            );

            if (link) {
              return (
                <Link key={notification.id} href={link} onClick={onNotificationClick}>
                  {content}
                </Link>
              );
            }

            return <div key={notification.id}>{content}</div>;
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral">
        <Link
          href="/notifications"
          onClick={onNotificationClick}
          className="text-sm text-accent hover:underline"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
```

---

## 3. 檔案結構

```
src/components/notification/
├── NotificationBell.tsx      # 修改：加入 Popover 邏輯
├── NotificationPopover.tsx   # 新增：Popover 元件
├── NotificationItem.tsx      # 現有
├── NotificationList.tsx      # 現有
└── NotificationEmpty.tsx     # 現有
```

---

## 4. 驗收標準

- [ ] 點擊鈴鐺顯示 Popover（不是跳轉）
- [ ] Popover 顯示最近 5 筆通知
- [ ] 點擊通知跳轉並關閉 Popover
- [ ] 點擊外部關閉 Popover
- [ ] ESC 關閉 Popover
- [ ] 底部有「View all notifications」連結
- [ ] 未讀通知有不同背景色
- [ ] 複用 `Timestamp`, `getNotificationIcon`, `getNotificationMessage`, `getNotificationLink`
