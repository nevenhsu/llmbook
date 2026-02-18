# 05 - Follow System

> **目標：** 實作用戶追蹤功能，包含 Follow/Unfollow UI、API，以及追蹤者發文通知和被追蹤通知。

---

## 0. 必須複用的現有程式碼

| 類型 | 路徑 | 用途 |
|------|------|------|
| Utility | `src/lib/server/route-helpers.ts` | `withAuth`, `http.*`, `parseJsonBody`, `validateBody` |
| Component | `src/components/ui/Avatar.tsx` | 用戶頭像 |
| Component | `src/components/ui/PaginationClient.tsx` | Follower/Following 列表分頁 |
| Lib | `src/lib/notifications.ts` | `createNotification` 函數 |

---

## 1. 功能概述

### 1.1 核心功能

| 功能 | 說明 |
|------|------|
| Follow 按鈕 | 在用戶個人頁面顯示 Follow/Unfollow 按鈕 |
| Follower/Following 計數 | 在用戶個人頁面顯示粉絲數和追蹤數 |
| 被追蹤通知 | 有人追蹤你時收到通知 |
| 追蹤者發文通知 | 你追蹤的人發新文章時收到通知 |

### 1.2 Follower/Following 列表頁面

| 頁面 | 可見性 |
|------|--------|
| `/profile/[username]/followers` | **公開** - 任何人可查看 |
| `/profile/[username]/following` (User) | **私有** - 只有本人可查看 |
| `/personas/[username]/following` (Persona) | **公開** - 任何人可查看 |

### 1.3 不包含的功能

- 追蹤 Board 功能
- 追蹤者評論通知（只通知發文）

---

## 2. API Endpoints

### 2.1 POST `/api/follows` - 追蹤用戶

```typescript
// POST /api/follows
// Body: { followingId: string }

// ✅ 使用現有的 route helpers（不要自己寫認證邏輯）
import { withAuth, http, parseJsonBody, validateBody } from "@/lib/server/route-helpers";
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

export const runtime = "nodejs";

export const POST = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ followingId: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const validation = validateBody(bodyResult, ["followingId"]);
  if (!validation.valid) return validation.response;

  const { followingId } = validation.data;

  // 不能追蹤自己
  if (followingId === user.id) {
    return http.badRequest("Cannot follow yourself");
  }

  // 檢查目標用戶是否存在
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url")
    .eq("user_id", followingId)
    .single();

  if (!targetUser) {
    return http.notFound("User not found");
  }

  // 檢查是否已追蹤
  const { data: existingFollow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", followingId)
    .maybeSingle();

  if (existingFollow) {
    return http.badRequest("Already following this user");
  }

  // 建立追蹤關係
  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    following_id: followingId,
  });

  if (error) {
    console.error("Error creating follow:", error);
    return http.internalError();
  }

  // 取得追蹤者資訊（用於通知）
  const { data: follower } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url")
    .eq("user_id", user.id)
    .single();

  // 發送被追蹤通知
  await createNotification(followingId, NOTIFICATION_TYPES.NEW_FOLLOWER, {
    followerId: user.id,
    followerUsername: follower?.username || "",
    followerDisplayName: follower?.display_name || "Someone",
    followerAvatarUrl: follower?.avatar_url,
  });

  return http.created({ success: true });
});
```

### 2.2 DELETE `/api/follows` - 取消追蹤

```typescript
// DELETE /api/follows
// Body: { followingId: string }

export const DELETE = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ followingId: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { followingId } = bodyResult;

  if (!followingId) {
    return http.badRequest("followingId is required");
  }

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", followingId);

  if (error) {
    console.error("Error deleting follow:", error);
    return http.internalError();
  }

  return http.ok({ success: true });
});
```

### 2.3 DELETE `/api/follows/remove-follower` - 移除粉絲

讓用戶可以移除自己的粉絲（解除對方對自己的追蹤）：

```typescript
// DELETE /api/follows/remove-follower
// Body: { followerId: string }

export const DELETE = withAuth(async (req, { user, supabase }) => {
  const bodyResult = await parseJsonBody<{ followerId: string }>(req);
  if (bodyResult instanceof Response) return bodyResult;

  const { followerId } = bodyResult;

  if (!followerId) {
    return http.badRequest("followerId is required");
  }

  // 刪除對方對自己的追蹤關係
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)      // 追蹤者是對方
    .eq("following_id", user.id);        // 被追蹤的是自己

  if (error) {
    console.error("Error removing follower:", error);
    return http.internalError();
  }

  return http.ok({ success: true });
});
```

### 2.4 GET `/api/follows/status` - 檢查追蹤狀態

```typescript
// GET /api/follows/status?userId=<userId>

export const GET = withAuth(async (req, { user, supabase }) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return http.badRequest("userId is required");
  }

  // 檢查是否已追蹤
  const { data: follow } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("following_id", userId)
    .maybeSingle();

  return http.ok({ isFollowing: !!follow });
});
```

### 2.4 GET `/api/users/[username]/followers` - 獲取粉絲列表（可選）

```typescript
// GET /api/users/[username]/followers?limit=20&cursor=<created_at>

export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const cursor = searchParams.get("cursor");

  const supabase = await getSupabaseServerClient();

  // 先找到用戶
  const { data: user } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();

  if (!user) {
    return http.notFound("User not found");
  }

  let query = supabase
    .from("follows")
    .select(`
      id, created_at,
      profiles!follows_follower_id_fkey(user_id, username, display_name, avatar_url)
    `)
    .eq("following_id", user.user_id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching followers:", error);
    return http.internalError();
  }

  const items = data ?? [];
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const nextCursor = hasMore && items.length > 0 
    ? items[items.length - 1].created_at 
    : undefined;

  return http.ok({ items, hasMore, nextCursor });
}
```

---

## 3. FollowButton 元件

**建立 `src/components/follow/FollowButton.tsx`：**

```tsx
"use client";

import { useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useOptionalUserContext } from "@/contexts/UserContext";

interface FollowButtonProps {
  userId: string;
  initialIsFollowing?: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

export default function FollowButton({
  userId,
  initialIsFollowing = false,
  onFollowChange,
  className = "",
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isLoading, setIsLoading] = useState(false);
  const userContext = useOptionalUserContext();

  // 未登入或是自己的頁面不顯示
  if (!userContext?.user || userContext.user.id === userId) {
    return null;
  }

  const handleClick = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const newState = !isFollowing;

    try {
      const res = await fetch("/api/follows", {
        method: newState ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: userId }),
      });

      if (!res.ok) {
        throw new Error("Failed to update follow status");
      }

      setIsFollowing(newState);
      onFollowChange?.(newState);
    } catch (error) {
      console.error("Error updating follow:", error);
      // 可以加 toast 提示
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`btn ${isFollowing ? "btn-outline" : "btn-primary"} btn-sm gap-2 ${className}`}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isFollowing ? (
        <UserCheck size={16} />
      ) : (
        <UserPlus size={16} />
      )}
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
```

---

## 4. 個人頁面整合

### 4.1 修改 Profile 頁面

**更新 `src/app/profile/[username]/page.tsx`：**

```tsx
import FollowButton from "@/components/follow/FollowButton";
import Avatar from "@/components/ui/Avatar";  // ✅ 使用現有元件

// 在頁面組件中取得追蹤資訊
export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();
  
  // 取得當前用戶
  const { data: { user } } = await supabase.auth.getUser();
  
  // 取得目標用戶資料
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, bio, karma, follower_count, following_count, created_at")
    .eq("username", username)
    .single();

  if (!profile) {
    notFound();
  }

  // 檢查是否已追蹤（只有登入且不是自己才檢查）
  let isFollowing = false;
  if (user && user.id !== profile.user_id) {
    const { data: follow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.user_id)
      .maybeSingle();
    isFollowing = !!follow;
  }

  return (
    <div>
      {/* Profile Header */}
      <div className="flex items-start gap-4">
        {/* ✅ 使用 fallbackSeed（Avatar 元件的正確 prop） */}
        <Avatar src={profile.avatar_url} fallbackSeed={profile.username} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{profile.display_name}</h1>
            <FollowButton 
              userId={profile.user_id} 
              initialIsFollowing={isFollowing}
            />
          </div>
          <p className="text-base-content/70">@{profile.username}</p>
          
          {/* Follower/Following counts */}
          <div className="mt-2 flex gap-4 text-sm">
            <span>
              <strong>{profile.follower_count}</strong>{" "}
              <span className="text-base-content/70">followers</span>
            </span>
            <span>
              <strong>{profile.following_count}</strong>{" "}
              <span className="text-base-content/70">following</span>
            </span>
          </div>
        </div>
      </div>

      {/* Rest of profile page */}
    </div>
  );
}
```

---

## 5. 追蹤者發文通知

### 5.1 修改發文 API

**更新 `src/app/api/posts/route.ts`：**

```typescript
import { createNotification } from "@/lib/notifications";
import { NOTIFICATION_TYPES } from "@/types/notification";

// 在 POST handler 中，創建文章成功後：

// 取得所有追蹤者
const { data: followers } = await supabase
  .from("follows")
  .select("follower_id")
  .eq("following_id", user.id);

// 發送通知給所有追蹤者
if (followers && followers.length > 0) {
  // 取得作者資訊
  const { data: author } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("user_id", user.id)
    .single();

  // 批量發送通知（考慮效能，可以改用 background job）
  const notifications = followers.map((f) => ({
    user_id: f.follower_id,
    type: NOTIFICATION_TYPES.FOLLOWED_USER_POST,
    payload: {
      postId: post.id,
      postTitle: title,
      authorId: user.id,
      authorUsername: author?.username || "",
      authorDisplayName: author?.display_name || "Someone",
    },
  }));

  // 使用 supabase insert 批量插入（效能較好）
  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }
}
```

### 5.2 效能優化考量

如果用戶有很多追蹤者，直接在 API request 中發送通知會很慢。建議：

1. **限制通知數量**：只通知最近活躍的 N 個追蹤者
2. **使用 Background Job**：將通知發送放到 queue 中非同步處理
3. **使用 Database Trigger**：在 DB 層級觸發通知（複雜度較高）

簡單版本先用同步發送，未來可以改進。

---

## 6. Follower/Following 列表頁面

### 6.1 頁面結構

```
/profile/[username]/followers  → 公開，顯示誰追蹤此用戶
/profile/[username]/following  → 私有（只有本人），顯示此用戶追蹤誰
/personas/[username]/following → 公開，顯示此 Persona 追蹤誰
```

### 6.2 API Endpoints

**GET `/api/users/[username]/followers`** - 公開

```typescript
// 任何人都可以查看
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await getSupabaseServerClient();

  // 找到用戶
  const { data: user } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();

  if (!user) return http.notFound("User not found");

  // 獲取追蹤者列表
  const { data, error } = await supabase
    .from("follows")
    .select(`
      id, created_at,
      follower:profiles!follows_follower_id_fkey(user_id, username, display_name, avatar_url)
    `)
    .eq("following_id", user.user_id)
    .order("created_at", { ascending: false })
    .limit(50);

  // ... pagination logic
  return http.ok({ items, hasMore, nextCursor });
}
```

**GET `/api/users/[username]/following`** - 私有（用戶）/ 公開（Persona）

```typescript
export async function GET(req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  // 找到目標用戶
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("username", username)
    .single();

  if (!targetUser) {
    // 檢查是否是 Persona
    const { data: persona } = await supabase
      .from("personas")
      .select("id")
      .eq("username", username)
      .single();

    if (persona) {
      // Persona following 是公開的
      return getFollowingList(supabase, persona.id, "persona");
    }
    return http.notFound("User not found");
  }

  // 用戶的 following 只有本人可查看
  if (!currentUser || currentUser.id !== targetUser.user_id) {
    return http.forbidden("You can only view your own following list");
  }

  return getFollowingList(supabase, targetUser.user_id, "user");
}
```

### 6.3 頁面元件

**建立 `src/app/profile/[username]/followers/page.tsx`：**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import FollowList from "@/components/follow/FollowList";

export default async function FollowersPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch initial followers
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users/${username}/followers`);
  if (!res.ok) notFound();
  const data = await res.json();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold mb-4">Followers of @{username}</h1>
      <FollowList 
        initialItems={data.items} 
        initialHasMore={data.hasMore}
        endpoint={`/api/users/${username}/followers`}
      />
    </div>
  );
}
```

**建立 `src/app/profile/[username]/following/page.tsx`：**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useOptionalUserContext } from "@/contexts/UserContext";
import FollowList from "@/components/follow/FollowList";

export default function FollowingPage({ params }: { params: Promise<{ username: string }> }) {
  const [username, setUsername] = useState<string>("");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const userContext = useOptionalUserContext();

  useEffect(() => {
    params.then(p => {
      setUsername(p.username);
      // 檢查是否是本人
      if (userContext?.user) {
        // 需要比對 username
        setIsAuthorized(userContext.profile?.username === p.username);
      } else {
        setIsAuthorized(false);
      }
    });
  }, [params, userContext]);

  if (isAuthorized === null) {
    return <div>Loading...</div>;
  }

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-center">
        <p className="text-base-content/70">This list is private.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold mb-4">People you follow</h1>
      <FollowList endpoint={`/api/users/${username}/following`} />
    </div>
  );
}
```

### 6.4 FollowList 元件（使用 Pagination UI）

> **注意：** Follower/Following 列表使用頁碼式分頁，不是無限滾動

**必須複用的元件：**
- `src/components/ui/PaginationClient.tsx` - 頁碼 UI（Client Component）
- `src/components/ui/Avatar.tsx` - 用戶頭像

**列表類型與操作按鈕：**

| 列表類型 | 操作按鈕 | 說明 |
|----------|----------|------|
| Following | Unfollow | 取消追蹤此用戶 |
| Followers | Remove | 移除此粉絲（解除對方的追蹤關係） |

**建立 `src/components/follow/FollowList.tsx`：**

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import PaginationClient from "@/components/ui/PaginationClient";
import { Loader2, UserMinus, UserX } from "lucide-react";

interface FollowUser {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface FollowListProps {
  initialItems?: FollowUser[];
  initialTotalPages?: number;
  endpoint: string;
  variant: "following" | "followers";  // 決定顯示哪種操作按鈕
}

const ITEMS_PER_PAGE = 20;

export default function FollowList({
  initialItems = [],
  initialTotalPages = 1,
  endpoint,
  variant,
}: FollowListProps) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [isLoading, setIsLoading] = useState(initialItems.length === 0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchPage = async (pageNum: number) => {
    setIsLoading(true);

    const params = new URLSearchParams({
      page: pageNum.toString(),
      limit: ITEMS_PER_PAGE.toString(),
    });

    const res = await fetch(`${endpoint}?${params}`);
    const data = await res.json();

    setItems(data.items);
    setTotalPages(data.totalPages);
    setPage(pageNum);
    setIsLoading(false);
  };

  // 初始載入
  useEffect(() => {
    if (initialItems.length === 0) {
      fetchPage(1);
    }
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Unfollow（從 Following 列表移除）
  const handleUnfollow = async (userId: string) => {
    setRemovingId(userId);
    try {
      await fetch("/api/follows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followingId: userId }),
      });
      // Optimistic update
      setItems(prev => prev.filter(u => u.user_id !== userId));
    } catch (error) {
      console.error("Failed to unfollow:", error);
    } finally {
      setRemovingId(null);
    }
  };

  // Remove follower（從 Followers 列表移除）
  const handleRemoveFollower = async (followerId: string) => {
    setRemovingId(followerId);
    try {
      await fetch("/api/follows/remove-follower", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId }),
      });
      // Optimistic update
      setItems(prev => prev.filter(u => u.user_id !== followerId));
    } catch (error) {
      console.error("Failed to remove follower:", error);
    } finally {
      setRemovingId(null);
    }
  };

  if (items.length === 0 && !isLoading) {
    return <p className="text-base-content/50 text-center py-8">No users yet</p>;
  }

  return (
    <div>
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <>
          <div className="divide-y divide-neutral">
            {items.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center gap-3 p-4 hover:bg-base-200 transition-colors"
              >
                <Link href={`/profile/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar src={user.avatar_url} fallbackSeed={user.username} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium text-base-content truncate">{user.display_name}</p>
                    <p className="text-sm text-base-content/70 truncate">@{user.username}</p>
                  </div>
                </Link>

                {/* 操作按鈕 */}
                {variant === "following" ? (
                  <button
                    onClick={() => handleUnfollow(user.user_id)}
                    disabled={removingId === user.user_id}
                    className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                    title="Unfollow"
                  >
                    {removingId === user.user_id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserMinus size={16} />
                    )}
                    <span className="hidden sm:inline ml-1">Unfollow</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleRemoveFollower(user.user_id)}
                    disabled={removingId === user.user_id}
                    className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                    title="Remove follower"
                  >
                    {removingId === user.user_id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <UserX size={16} />
                    )}
                    <span className="hidden sm:inline ml-1">Remove</span>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ✅ 使用現有的 PaginationClient 元件 */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <PaginationClient
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### 6.5 API 回應格式（Offset-based Pagination）

```typescript
// GET /api/users/[username]/followers?page=1&limit=20

interface FollowListResponse {
  items: FollowUser[];
  totalPages: number;
  totalCount: number;
  page: number;
}

export async function GET(req: Request, { params }) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const offset = (page - 1) * limit;

  // 獲取總數
  const { count } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);

  // 獲取當頁資料
  const { data } = await supabase
    .from("follows")
    .select(`follower:profiles!follows_follower_id_fkey(...)`)
    .eq("following_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  return http.ok({
    items: data?.map(d => d.follower) || [],
    totalPages,
    totalCount,
    page,
  });
}
```

---

## 7. 檔案結構

```
src/
├── app/
│   ├── api/
│   │   ├── follows/
│   │   │   ├── route.ts            # POST (follow), DELETE (unfollow)
│   │   │   ├── remove-follower/
│   │   │   │   └── route.ts        # DELETE (remove follower)
│   │   │   └── status/
│   │   │       └── route.ts        # GET (check follow status)
│   │   └── users/
│   │       └── [username]/
│   │           ├── followers/
│   │           │   └── route.ts    # GET (public)
│   │           └── following/
│   │               └── route.ts    # GET (private for user, public for persona)
│   ├── profile/
│   │   └── [username]/
│   │       ├── page.tsx            # 更新：加入 FollowButton + follower/following 連結
│   │       ├── followers/
│   │       │   └── page.tsx        # 新增：Followers 列表頁（有 Remove 按鈕）
│   │       └── following/
│   │           └── page.tsx        # 新增：Following 列表頁（私有，有 Unfollow 按鈕）
│   └── personas/
│       └── [username]/
│           └── following/
│               └── page.tsx        # 新增：Persona Following 列表頁（公開，無按鈕）
├── components/
│   └── follow/
│       ├── FollowButton.tsx        # Follow/Unfollow 按鈕
│       └── FollowList.tsx          # 新增：追蹤者/追蹤中列表（含操作按鈕）
└── types/
    └── notification.ts             # 已有 NEW_FOLLOWER, FOLLOWED_USER_POST 類型
```

---

## 7. 測試要點

### 7.1 單元測試

- FollowButton 正確顯示狀態
- 未登入時不顯示按鈕
- 自己的頁面不顯示按鈕

### 7.2 整合測試

- 追蹤用戶成功
- 取消追蹤成功
- 被追蹤者收到通知
- 追蹤者發文時收到通知
- Follower/Following 計數正確更新

### 7.3 邊界測試

- 不能追蹤自己
- 不能重複追蹤
- 取消追蹤不存在的關係

---

## 8. UI 互動細節

### 8.1 按鈕狀態

| 狀態 | 外觀 | 文字 |
|------|------|------|
| 未追蹤 | `btn-primary` | "Follow" |
| 已追蹤 | `btn-outline` | "Following" |
| 載入中 | disabled + spinner | - |
| Hover (已追蹤) | `btn-error` (可選) | "Unfollow" |

### 8.2 Optimistic Update

追蹤/取消追蹤應立即更新 UI，不等 API 回應：

```tsx
const handleClick = async () => {
  const newState = !isFollowing;
  
  // Optimistic update
  setIsFollowing(newState);
  
  try {
    await fetch(...);
  } catch {
    // Revert on error
    setIsFollowing(!newState);
  }
};
```

---

## 9. 驗收標準

- [ ] `follows` API endpoints 實作完成
- [ ] FollowButton 元件實作完成
- [ ] 個人頁面顯示 Follow 按鈕
- [ ] 個人頁面顯示 follower/following 計數
- [ ] 追蹤時被追蹤者收到 `NEW_FOLLOWER` 通知
- [ ] 追蹤者發文時粉絲收到 `FOLLOWED_USER_POST` 通知
- [ ] 不能追蹤自己
- [ ] 計數正確更新（trigger 或手動）
- [ ] `npm run build` 無錯誤
