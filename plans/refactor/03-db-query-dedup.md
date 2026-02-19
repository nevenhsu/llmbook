# P1b — 消除重複 Supabase 查詢

> **優先順序：P1 — 高優先**  
> Board 相關頁面每次請求執行 4+ 次相同 DB 查詢，`board-permissions.ts` 的 5 個函式重複查詢同一張表。

---

## 問題 1：Board 頁面重複 DB 查詢

### 問題描述

`/r/[slug]` 的 `layout.tsx` 和 `page.tsx` 都各自執行：

1. `getUser()` ✅ 已有 `cache()`，不重複
2. `getBoardBySlug(slug)` ✅ 已有 `cache()`，不重複
3. `isAdmin(user.id, supabase)` ❌ **無 cache，執行兩次**
4. `isBoardModerator(board.id, user.id, supabase)` ❌ **無 cache，執行兩次**
5. membership 查詢（`board_members` 表） ❌ **各自執行**

### 受影響檔案

- `src/app/r/[slug]/layout.tsx`
- `src/app/r/[slug]/page.tsx`
- `src/lib/admin.ts`（`isAdmin` 函式）
- `src/lib/board-permissions.ts`（`isBoardModerator` 等函式）

### 修正方案

#### 方案 A（推薦）：為 `isAdmin` 和 `isBoardModerator` 加上 React `cache()`

React 的 `cache()` 在同一個伺服器請求生命週期內，相同參數的呼叫只執行一次，這與 `getUser()` 和 `getBoardBySlug()` 的現有模式完全一致。

**Step 1：修改 `src/lib/admin.ts`**

```typescript
// Before
import { createClient } from "@/lib/supabase/server";

export async function isAdmin(userId: string, supabase?: SupabaseClient): Promise<boolean> {
  // ... 查詢
}

// After
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const isAdmin = cache(async (userId: string): Promise<boolean> => {
  const supabase = await createClient();
  // ... 查詢
  // 注意：移除 supabase 參數，統一由內部創建 client
});
```

**Step 2：修改 `src/lib/board-permissions.ts` 的 `isBoardModerator`**

```typescript
// Before
export async function isBoardModerator(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  // ...
}

// After
import { cache } from "react";

export const isBoardModerator = cache(async (boardId: string, userId: string): Promise<boolean> => {
  const supabase = await createClient();
  // ...
});
```

**注意**：`cache()` 的 key 基於參數的引用相等性，對於字串參數（userId、boardId）完全可靠。

**Step 3：更新所有呼叫端**

搜尋 `isAdmin(` 和 `isBoardModerator(` 的所有呼叫，移除傳入的 `supabase` 參數（因為函式內部現在自己創建）。

主要呼叫點：

- `src/app/r/[slug]/layout.tsx`
- `src/app/r/[slug]/page.tsx`
- `src/app/r/[slug]/posts/[id]/page.tsx`
- `src/app/admin/` 相關頁面

---

## 問題 2：`board-permissions.ts` 的 5 個函式重複查詢

### 問題描述

以下 5 個函式都查詢 `board_moderators` 表，只是取的欄位不同：

```typescript
isBoardModerator(boardId, userId); // SELECT id
isBoardOwner(boardId, userId); // SELECT role
canManageBoard(boardId, userId); // SELECT role, permissions
canManageBoardPosts(boardId, userId); // SELECT role, permissions
canManageBoardUsers(boardId, userId); // SELECT role, permissions
getUserBoardRole(boardId, userId); // SELECT role
```

如果同一個請求需要多個權限檢查（例如 Board settings 頁面同時需要 `canManageBoard` 和 `isBoardOwner`），就會觸發多次查詢。

### 修正方案

#### Step 1：建立底層快取函式

在 `src/lib/board-permissions.ts` 頂部加入：

```typescript
import { cache } from "react";

/**
 * 從 board_moderators 取得完整的版主記錄（role + permissions）。
 * 使用 React cache() 確保同一請求內相同參數只查詢一次。
 * 返回 null 表示該使用者不是版主。
 */
const getBoardModeratorRecord = cache(
  async (
    boardId: string,
    userId: string,
    supabase?: SupabaseClient,
  ): Promise<{ role: string; permissions: string[] } | null> => {
    const client = supabase ?? (await createClient());
    const { data } = await client
      .from("board_moderators")
      .select("role, permissions")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();
    return data ?? null;
  },
);
```

#### Step 2：重構現有函式以使用底層快取

```typescript
export async function isBoardModerator(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  return record !== null;
}

export async function isBoardOwner(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  return record?.role === "owner";
}

export async function getUserBoardRole(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<string | null> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  return record?.role ?? null;
}

export async function canManageBoard(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  if (!record) return false;
  return record.role === "owner" || record.permissions?.includes("manage_settings");
}

export async function canManageBoardPosts(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  if (!record) return false;
  return record.role === "owner" || record.permissions?.includes("manage_posts");
}

export async function canManageBoardUsers(
  boardId: string,
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  const record = await getBoardModeratorRecord(boardId, userId, supabase);
  if (!record) return false;
  return record.role === "owner" || record.permissions?.includes("manage_users");
}
```

**重要**：請先確認 `permissions` 欄位的實際 DB schema（可能是 `jsonb[]` 或 `text[]`），確保 `includes()` 的用法正確。

---

## 問題 3：Board Page 取 101 筆資料只用 20 筆

### 問題描述

```typescript
// src/app/page.tsx（約第 48-54 行）
const postsQuery = buildPostsQuery({ limit: 100 }); // 取 100 筆
const sortedPosts = sortPosts(rawPosts, sortBy); // JS 層排序
const topPosts = sortedPosts.slice(0, 20); // 只用 20 筆
```

而 `ranking.ts` 中已有 `getHotPostsFromCache()` 和 `getRisingPostsFromCache()`，能直接從 `post_rankings` cache 表取得已排序的結果，不需要取 100 筆再排序。

### 修正方案

在 `src/app/page.tsx` 的資料獲取邏輯中：

```typescript
// Before（低效）
const rawPosts = await fetchPosts({ limit: 100 });
const sortedPosts = sortPosts(rawPosts, sortBy);
const topPosts = sortedPosts.slice(0, 20);

// After（高效）
let posts: FeedPost[];
if (sortBy === "hot") {
  posts = await getHotPostsFromCache({ limit: 20, ...otherParams });
} else if (sortBy === "rising") {
  posts = await getRisingPostsFromCache({ limit: 20, ...otherParams });
} else {
  // new, top, best 等其他排序仍用原邏輯，但 limit 直接設 20
  posts = await fetchPosts({ limit: 20, sort: sortBy });
}
```

**注意**：需確認 `getHotPostsFromCache` 的回傳格式是否與 `FeedPost` 一致，如果不一致需要進行格式轉換。

---

## 驗收標準

- [ ] Board 相關頁面的 `isAdmin` 和 `isBoardModerator` 在同一請求中只執行一次查詢（可透過 Supabase Dashboard → Logs 驗證）。
- [ ] `board-permissions.ts` 中的權限函式全部委托給 `getBoardModeratorRecord`，無重複 DB 查詢。
- [ ] 首頁 Hot/Rising 排序使用 cache 表，不再取 100 筆再 slice。
- [ ] `pnpm test` 全部通過。
- [ ] 功能驗證：Board 頁面版主功能、首頁排序均正常。
