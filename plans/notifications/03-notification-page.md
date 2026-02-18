# 03 - Notification Page Refactoring

> **目標：** 重構 `/notifications` 頁面，實作無限滾動、點擊跳轉、軟刪除，並複用現有的 UI 元件。

---

## 0. 必須複用的現有程式碼

> **重要：** 以下程式碼必須複用，不可重新實作

| 類型 | 路徑 | 用途 |
|------|------|------|
| Hook | `src/hooks/use-infinite-scroll.ts` | 無限滾動邏輯 |
| Component | `src/components/ui/Avatar.tsx` | 用戶頭像 |
| Component | `src/components/ui/Timestamp.tsx` | 相對時間 |
| Component | `src/components/ui/Skeleton.tsx` | 載入骨架 |

| Utility | `src/lib/server/route-helpers.ts` | `withAuth`, `http.*`, `parseJsonBody` |
| Type | `src/lib/pagination.ts` | `PaginatedResponse<T>`, `getNextCursor` |

---

## 1. 現狀分析

### 1.1 現有問題

| 問題 | 說明 |
|------|------|
| 無分頁 | 目前 API 只回傳最多 50 筆 |
| 類型不符 | 前端 interface 與 DB 不一致 |
| 無跳轉 | 通知不可點擊導航 |
| 無刪除 | 不能刪除通知 |
| Archive 連結 | 指向未實作頁面 |
| 未複用元件 | 未使用 `components/ui/` 的共用元件 |

### 1.2 要移除的功能

- `/notifications/archive` 頁面 → **刪除整個目錄**
- Archive tab → **移除**

---

## 2. API 變更

### 2.1 GET `/api/notifications` 更新

**現有實作（簡化版）：**
```typescript
// 目前回傳全部，限 50 筆
const { data } = await supabase
  .from("notifications")
  .select("*")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .limit(50);
```

**新實作規格：**

```typescript
// GET /api/notifications?cursor=<ISO_DATE>&limit=20

interface NotificationQueryParams {
  cursor?: string;    // ISO date string, 用於 cursor-based pagination
  limit?: number;     // 預設 20，最大 50
  unreadOnly?: boolean; // 僅顯示未讀
}

// ✅ 使用現有的 PaginatedResponse 格式（src/lib/pagination.ts）
import type { PaginatedResponse } from "@/lib/pagination";

type NotificationListResponse = PaginatedResponse<NotificationRow>;
// 等同於:
// {
//   items: NotificationRow[];
//   hasMore: boolean;
//   nextCursor?: string;
//   nextOffset?: number;  // 通知用 cursor，此欄位不使用
// }
```

**實作要點：**

```typescript
import { withAuth, http } from "@/lib/server/route-helpers";
import { calculateHasMore, getNextCursor } from "@/lib/pagination";
import type { NotificationRow } from "@/types/notification";

export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  let query = supabase
    .from("notifications")
    .select("id, user_id, type, payload, read_at, deleted_at, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)  // 排除軟刪除
    .order("created_at", { ascending: false })
    .limit(limit + 1);  // +1 for hasMore check

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  if (unreadOnly) {
    query = query.is("read_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error);
    return http.internalError();
  }

  const items = (data ?? []) as NotificationRow[];
  
  // ✅ 使用現有的 pagination utilities
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop();
  }
  
  const nextCursor = getNextCursor(items);  // 使用現有函數

  // ✅ 回傳標準 PaginatedResponse 格式
  return http.ok({ items, hasMore, nextCursor });
});
```

### 2.2 新增 DELETE `/api/notifications/[id]` 

軟刪除單一通知：

```typescript
// DELETE /api/notifications/[id]

export const DELETE = withAuth(async (req, { user, supabase }, { params }) => {
  const { id } = await params;

  const { error } = await supabase
    .from("notifications")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return http.internalError();
  }

  return http.ok({ success: true });
});
```

### 2.3 新增批量刪除（可選）

```typescript
// DELETE /api/notifications (body: { ids: string[] })

export const DELETE = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ ids: string[] }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { ids } = bodyResult;

  if (!Array.isArray(ids) || ids.length === 0) {
    return http.badRequest("ids array is required");
  }

  const { error } = await supabase
    .from("notifications")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids)
    .eq("user_id", user.id);

  if (error) {
    return http.internalError();
  }

  return http.ok({ success: true });
});
```

---

## 3. 元件架構

### 3.1 檔案結構

```
src/components/notification/
├── NotificationBell.tsx      # 現有，可能微調
├── NotificationItem.tsx      # 新增：單一通知項目
├── NotificationList.tsx      # 新增：通知列表（含無限滾動）
└── NotificationEmpty.tsx     # 新增：空狀態元件
```

### 3.2 NotificationItem 元件

**Props Interface：**

```typescript
interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}
```

**功能需求：**

1. 顯示通知圖標（根據 type）
2. 顯示通知訊息（使用 `getNotificationMessage`）
3. 顯示時間戳（使用 `<Timestamp />` 元件）
4. 未讀狀態樣式（背景色區分）
5. 點擊跳轉（使用 `getNotificationLink`）
6. Mark as read 按鈕
7. Delete 按鈕（hover 時顯示）

**UI 結構：**

```tsx
<Link href={link} onClick={handleClick}>
  <div className={cn(
    "flex items-start gap-3 p-4 hover:bg-base-200 transition-colors",
    !notification.read_at && "bg-base-200/50"
  )}>
    {/* Icon */}
    <div className="flex-shrink-0 mt-1">
      {getNotificationIcon(notification.type)}
    </div>
    
    {/* Content */}
    <div className="flex-1 min-w-0">
      <p className="text-sm text-base-content break-words">
        {getNotificationMessage(notification)}
      </p>
      <Timestamp date={notification.created_at} className="mt-1" />
    </div>
    
    {/* Actions */}
    <div className="flex-shrink-0 flex items-center gap-2">
      {!notification.read_at && (
        <button onClick={handleMarkRead} className="text-xs text-upvote">
          Mark read
        </button>
      )}
      <button 
        onClick={handleDelete} 
        className="opacity-0 group-hover:opacity-100 text-error"
      >
        <Trash2 size={16} />
      </button>
    </div>
  </div>
</Link>
```

### 3.3 NotificationList 元件

**Props Interface：**

```typescript
interface NotificationListProps {
  initialNotifications: NotificationRow[];
  initialHasMore: boolean;
  initialNextCursor?: string;
}
```

**功能需求：**

1. 接收 SSR 初始資料（可選，也可純 client-side）
2. 無限滾動載入更多
3. 管理通知狀態（read/delete）
4. **必須使用** `useInfiniteScroll` hook

**實作要點（使用現有 hook）：**

```tsx
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { Loader2 } from "lucide-react";

export function NotificationList({ 
  initialNotifications = [],
  initialHasMore = true,
  initialNextCursor
}: NotificationListProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    
    const params = new URLSearchParams({ limit: "20" });
    if (nextCursor) params.set("cursor", nextCursor);
    
    const res = await fetch(`/api/notifications?${params}`);
    const data = await res.json();
    
    setNotifications(prev => [...prev, ...data.items]);
    setHasMore(data.hasMore);
    setNextCursor(data.nextCursor);
    setIsLoading(false);
  }, [nextCursor, hasMore, isLoading]);

  // ✅ 使用現有的 useInfiniteScroll hook（不要自己寫 IntersectionObserver）
  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading);

  // ... handlers for markRead, delete, etc.
  
  return (
    <div className="divide-y divide-neutral">
      {notifications.map((n) => (
        <NotificationItem
          key={n.id}
          notification={n}
          onMarkRead={handleMarkRead}
          onDelete={handleDelete}
        />
      ))}
      
      {/* ✅ Sentinel element for infinite scroll */}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center">
        {isLoading && <Loader2 className="animate-spin" size={24} />}
      </div>
    </div>
  );
}
```

---

## 4. 頁面重構

### 4.1 `/notifications/page.tsx` 新結構

```tsx
"use client";

import { useState, useEffect } from "react";
import { Settings, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { NotificationList } from "@/components/notification/NotificationList";
import { NotificationEmpty } from "@/components/notification/NotificationEmpty";
import type { NotificationRow } from "@/types/notification";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ limit: "20" });
    if (activeTab === "unread") params.set("unreadOnly", "true");
    
    const res = await fetch(`/api/notifications?${params}`);
    const data = await res.json();
    
    setNotifications(data.items);
    setHasMore(data.hasMore);
    setNextCursor(data.nextCursor);
    setIsLoading(false);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setIsMarkingAllRead(true);
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    });
    
    setNotifications(prev => 
      prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
    );
    setIsMarkingAllRead(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-24 sm:pb-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        {/* 移除 settings 連結，因為不實作 settings 頁面 */}
      </div>

      {/* Tabs - 移除 Archive */}
      <div className="border-neutral mb-4 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "pb-2 text-sm font-bold",
              activeTab === "all" 
                ? "text-base-content border-upvote border-b-2" 
                : "text-base-content/70 hover:text-base-content"
            )}
          >
            All ({notifications.length})
          </button>
          {unreadCount > 0 && (
            <button
              onClick={() => setActiveTab("unread")}
              className={cn(
                "pb-2 text-sm",
                activeTab === "unread"
                  ? "text-base-content border-upvote border-b-2 font-bold"
                  : "text-base-content/70 hover:text-base-content"
              )}
            >
              Unread ({unreadCount})
            </button>
          )}
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={isMarkingAllRead}
            className="text-upvote flex items-center gap-2 text-sm hover:underline"
          >
            {isMarkingAllRead ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="text-base-content/50 animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <NotificationEmpty />
      ) : (
        <NotificationList
          initialNotifications={notifications}
          initialHasMore={hasMore}
          initialNextCursor={nextCursor}
        />
      )}
    </div>
  );
}
```

### 4.2 刪除 Archive 頁面

刪除整個目錄：`src/app/notifications/archive/`

---

## 5. 必須複用的 UI 元件

> **警告：** 不可自己重新實作這些元件

| 元件 | 路徑 | 用途 | 使用位置 |
|------|------|------|----------|
| `Timestamp` | `@/components/ui/Timestamp` | 顯示相對時間 | NotificationItem |
| `Avatar` | `@/components/ui/Avatar` | 顯示用戶頭像 | NotificationItem（某些類型）|
| `Skeleton` | `@/components/ui/Skeleton` | 載入中骨架屏 | NotificationList |


### Avatar 元件用法

注意 Avatar 使用 `fallbackSeed` 而非 `username`：

```tsx
import Avatar from "@/components/ui/Avatar";

// ✅ 正確用法
<Avatar 
  src={avatarUrl} 
  fallbackSeed={username}  // 注意是 fallbackSeed
  size="sm" 
/>

// ❌ 錯誤（沒有 username prop）
<Avatar src={avatarUrl} username={username} size="sm" />
```

---

## 6. 點擊跳轉實作

### 6.1 跳轉邏輯

```typescript
// 在 NotificationItem 中
const link = getNotificationLink(notification);

const handleClick = (e: React.MouseEvent) => {
  // 如果點擊的是 action 按鈕，不要跳轉
  if ((e.target as HTMLElement).closest('button')) {
    e.preventDefault();
    return;
  }
  
  // 自動標記為已讀
  if (!notification.read_at) {
    onMarkRead(notification.id);
  }
};

// 如果沒有連結，渲染為 div
if (!link) {
  return <div className="...">{/* content */}</div>;
}

return (
  <Link href={link} onClick={handleClick} className="group">
    {/* content */}
  </Link>
);
```

### 6.2 評論錨點滾動

對於 `#comment-{id}` 的錨點，需確保目標頁面有正確的 id 屬性：

```tsx
// 在 CommentItem.tsx 中
<div id={`comment-${comment.id}`} className="...">
  {/* comment content */}
</div>
```

---

## 7. 狀態管理

### 7.1 Optimistic Update

標記已讀和刪除應該先更新 UI，再發 API：

```typescript
const handleMarkRead = async (id: string) => {
  // Optimistic update
  setNotifications(prev => 
    prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
  );
  
  // API call
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });
};

const handleDelete = async (id: string) => {
  // Optimistic update
  setNotifications(prev => prev.filter(n => n.id !== id));
  
  // API call
  await fetch(`/api/notifications/${id}`, { method: "DELETE" });
};
```



---

## 8. 測試要點

### 8.1 單元測試

- `getNotificationMessage` 函數正確回傳訊息
- `getNotificationLink` 函數正確回傳連結
- `NotificationItem` 元件正確渲染

### 8.2 整合測試

- 無限滾動正常運作
- 標記已讀正確更新 UI
- 刪除通知正確移除
- 點擊跳轉到正確頁面

---

## 9. 驗收標準

- [ ] `/notifications` 頁面重構完成
- [ ] Archive 入口和頁面已移除
- [ ] 通知列表支援無限滾動
- [ ] 通知可點擊跳轉
- [ ] 通知可標記已讀
- [ ] 通知可刪除（軟刪除）
- [ ] 空狀態正確顯示
- [ ] 複用現有 UI 元件（Timestamp, Skeleton）
- [ ] API 支援 cursor-based pagination
- [ ] `npm run build` 無錯誤
