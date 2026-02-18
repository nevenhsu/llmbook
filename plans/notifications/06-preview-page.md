# 06 - Preview Page

> **目標：** 建立 `/preview/notifications` 頁面，使用假資料預覽通知 UI，方便快速確認樣式和功能。

---

## 0. 必須複用的現有程式碼

| 類型 | 路徑 | 用途 |
|------|------|------|
| Component | `src/components/ui/Avatar.tsx` | 用戶頭像 |
| Component | `src/components/ui/Timestamp.tsx` | 相對時間 |
| Type | `src/types/notification.ts` | `NotificationRow`, `NOTIFICATION_TYPES` |
| Lib | `src/types/notification.ts` | `getNotificationIcon`, `getNotificationMessage`, `getNotificationLink` |

---

## 1. 功能概述

Preview 頁面用於：
- 不需要真實資料即可預覽 UI
- 快速確認各種通知類型的顯示
- 測試無限滾動行為
- 確認空狀態顯示

---

## 2. 假資料定義

### 2.1 Mock Notifications

**建立 `src/app/preview/notifications/mock-data.ts`：**

```typescript
import { NotificationRow, NOTIFICATION_TYPES } from "@/types/notification";

// 生成假 UUID
const uuid = () => Math.random().toString(36).substring(2, 15);

// 生成假時間（過去幾分鐘/小時/天）
const ago = (minutes: number) => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date.toISOString();
};

export const MOCK_NOTIFICATIONS: NotificationRow[] = [
  // Post Upvote - 未讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.POST_UPVOTE,
    payload: {
      postId: "post-1",
      postTitle: "How to build a Reddit clone with Next.js and Supabase",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(5),
  },
  
  // Comment Reply - 未讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_REPLY,
    payload: {
      postId: "post-2",
      commentId: "comment-1",
      authorName: "Alice Chen",
      authorUsername: "alice",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(15),
  },
  
  // Comment Reply to Comment - 未讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_REPLY_TO_COMMENT,
    payload: {
      postId: "post-3",
      parentCommentId: "comment-2",
      commentId: "comment-3",
      authorName: "Bob Smith",
      authorUsername: "bobsmith",
      excerpt: "I totally agree with your point about...",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(30),
  },
  
  // Mention - 已讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.MENTION,
    payload: {
      postId: "post-4",
      commentId: "comment-4",
      authorName: "Carol Davis",
      authorUsername: "carol",
      context: "comment" as const,
    },
    read_at: ago(10),
    deleted_at: null,
    created_at: ago(60),
  },
  
  // New Follower - 已讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.NEW_FOLLOWER,
    payload: {
      followerId: "follower-1",
      followerUsername: "techguru",
      followerDisplayName: "Tech Guru",
      followerAvatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=techguru",
    },
    read_at: ago(20),
    deleted_at: null,
    created_at: ago(120),
  },
  
  // Followed User Post - 未讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.FOLLOWED_USER_POST,
    payload: {
      postId: "post-5",
      postTitle: "Announcing our new AI features",
      authorId: "author-1",
      authorUsername: "productteam",
      authorDisplayName: "Product Team",
    },
    read_at: null,
    deleted_at: null,
    created_at: ago(180),
  },
  
  // Comment Upvote - 已讀
  {
    id: uuid(),
    user_id: "mock-user",
    type: NOTIFICATION_TYPES.COMMENT_UPVOTE,
    payload: {
      postId: "post-6",
      commentId: "comment-5",
    },
    read_at: ago(100),
    deleted_at: null,
    created_at: ago(240),
  },
  
  // More notifications for pagination testing...
  ...Array.from({ length: 20 }, (_, i) => ({
    id: uuid(),
    user_id: "mock-user",
    type: i % 2 === 0 ? NOTIFICATION_TYPES.POST_UPVOTE : NOTIFICATION_TYPES.COMMENT_REPLY,
    payload: i % 2 === 0 
      ? { postId: `post-${i + 10}`, postTitle: `Sample post title ${i + 1}` }
      : { 
          postId: `post-${i + 10}`, 
          commentId: `comment-${i + 10}`, 
          authorName: `User ${i + 1}`,
          authorUsername: `user${i + 1}`,
        },
    read_at: i % 3 === 0 ? null : ago(300 + i * 60),
    deleted_at: null,
    created_at: ago(300 + i * 60),
  } as NotificationRow)),
];

// 模擬分頁
export function getMockNotifications(cursor?: string, limit: number = 20) {
  let startIndex = 0;
  
  if (cursor) {
    const cursorIndex = MOCK_NOTIFICATIONS.findIndex(n => n.created_at === cursor);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    }
  }
  
  const items = MOCK_NOTIFICATIONS.slice(startIndex, startIndex + limit + 1);
  const hasMore = items.length > limit;
  
  if (hasMore) {
    items.pop();
  }
  
  const nextCursor = hasMore && items.length > 0 
    ? items[items.length - 1].created_at 
    : undefined;
  
  return { items, hasMore, nextCursor };
}
```

---

## 3. Preview 頁面

### 3.1 頁面結構

**建立 `src/app/preview/notifications/page.tsx`：**

```tsx
"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { NotificationList } from "@/components/notification/NotificationList";
import { NotificationEmpty } from "@/components/notification/NotificationEmpty";
import { MOCK_NOTIFICATIONS, getMockNotifications } from "./mock-data";
import type { NotificationRow } from "@/types/notification";

export default function NotificationsPreviewPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>(() => {
    const { items } = getMockNotifications(undefined, 10);
    return items;
  });
  const [showEmpty, setShowEmpty] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  // 模擬標記已讀
  const handleMarkRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n
      )
    );
  }, []);

  // 模擬刪除
  const handleDelete = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 模擬全部標記已讀
  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
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
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-base-content/70">
          Preview Controls
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowEmpty(!showEmpty)}
            className={`btn btn-sm ${showEmpty ? "btn-primary" : "btn-outline"}`}
          >
            {showEmpty ? "Show Notifications" : "Show Empty State"}
          </button>
          <button onClick={handleMarkAllRead} className="btn btn-outline btn-sm">
            Mark All Read
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-3">
          <span className="text-base-content border-upvote border-b-2 pb-2 text-sm font-bold">
            All ({notifications.length})
          </span>
          {unreadCount > 0 && (
            <span className="text-base-content/70 pb-2 text-sm">
              Unread ({unreadCount})
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-upvote flex items-center gap-2 text-sm hover:underline"
          >
            <CheckCircle2 size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      {showEmpty ? (
        <NotificationEmpty />
      ) : (
        <div className="divide-neutral divide-y">
          {notifications.map((notification) => (
            <NotificationItemPreview
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
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-base-content/70">
          Notification Types in Preview
        </h2>
        <ul className="text-sm text-base-content/70 space-y-1">
          <li>- post_upvote (Post received upvote)</li>
          <li>- comment_upvote (Comment received upvote)</li>
          <li>- comment_reply (New comment on your post)</li>
          <li>- comment_reply_to_comment (Reply to your comment)</li>
          <li>- mention (Someone mentioned you)</li>
          <li>- new_follower (New follower)</li>
          <li>- followed_user_post (Followed user posted)</li>
        </ul>
      </div>
    </div>
  );
}

// 簡化版的 NotificationItem for preview
// 實際實作時使用 NotificationItem 元件
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { 
  getNotificationIcon, 
  getNotificationMessage, 
  getNotificationLink 
} from "@/types/notification";
import Timestamp from "@/components/ui/Timestamp";

function NotificationItemPreview({
  notification,
  onMarkRead,
  onDelete,
}: {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const link = getNotificationLink(notification);
  const message = getNotificationMessage(notification);
  const icon = getNotificationIcon(notification.type);

  const content = (
    <div
      className={`group flex items-start gap-3 p-4 transition-colors hover:bg-base-200 ${
        !notification.read_at ? "bg-base-200/50" : ""
      }`}
    >
      <div className="mt-1 flex-shrink-0">{icon}</div>

      <div className="min-w-0 flex-1">
        <p className="text-base-content break-words text-sm">{message}</p>
        <Timestamp date={notification.created_at} className="text-base-content/50 mt-1 text-xs" />
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {!notification.read_at && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            className="text-upvote text-xs hover:underline"
          >
            Mark read
          </button>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="text-error opacity-0 transition-opacity group-hover:opacity-100"
          title="Delete notification"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  // In preview mode, clicking shows an alert instead of navigating
  if (link) {
    return (
      <div
        onClick={() => alert(`Would navigate to: ${link}`)}
        className="cursor-pointer"
      >
        {content}
      </div>
    );
  }

  return content;
}
```

---

## 4. Empty State 元件

**建立 `src/components/notification/NotificationEmpty.tsx`：**

```tsx
import { Bell } from "lucide-react";

export function NotificationEmpty() {
  return (
    <div className="py-20 text-center">
      <Bell size={48} className="text-base-content/30 mx-auto mb-4" />
      <p className="text-base-content/50 text-lg">No notifications yet</p>
      <p className="text-base-content/30 mt-1 text-sm">
        You&apos;ll see notifications here when someone interacts with your content
      </p>
    </div>
  );
}
```

---

## 5. 測試情境

Preview 頁面應涵蓋以下情境：

### 5.1 通知類型

- [ ] `post_upvote` - 顯示文章標題
- [ ] `comment_upvote` - 顯示通用訊息
- [ ] `comment_reply` - 顯示作者名稱
- [ ] `comment_reply_to_comment` - 顯示作者名稱
- [ ] `mention` - 顯示作者名稱和 context
- [ ] `new_follower` - 顯示追蹤者名稱
- [ ] `followed_user_post` - 顯示作者和文章標題

### 5.2 狀態

- [ ] 未讀通知有不同背景色
- [ ] 已讀通知樣式正常
- [ ] 空狀態顯示

### 5.3 互動

- [ ] Mark as read 按鈕可用
- [ ] Delete 按鈕 hover 時顯示
- [ ] 點擊顯示目標連結（在 preview 中用 alert）

---

## 6. 檔案結構

```
src/app/preview/notifications/
├── page.tsx           # Preview 頁面
└── mock-data.ts       # 假資料

src/components/notification/
├── NotificationBell.tsx    # 現有
├── NotificationItem.tsx    # 新增
├── NotificationList.tsx    # 新增
└── NotificationEmpty.tsx   # 新增
```

---

## 7. 驗收標準

- [ ] `/preview/notifications` 頁面可正常存取
- [ ] 所有通知類型都有假資料
- [ ] 所有通知類型顯示正確
- [ ] 未讀/已讀狀態樣式正確
- [ ] Mark as read 功能正常（模擬）
- [ ] Delete 功能正常（模擬）
- [ ] 空狀態可切換顯示
- [ ] 點擊通知顯示目標連結
- [ ] `npm run build` 無錯誤
