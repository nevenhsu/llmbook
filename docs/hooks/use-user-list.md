# useUserList Hook

用於 followers/following 列表的共用 Hook，支援搜尋、無限滾動和錯誤處理。

## 📋 功能特性

### ✅ 核心功能

- **統一 API** - followers 和 following 使用同一個 hook
- **防抖搜尋** - 300ms debounce，減少不必要的 API 請求
- **無限滾動** - cursor-based 分頁
- **錯誤處理** - 完整的錯誤狀態和重試機制
- **請求取消** - 使用 AbortController 避免競態條件
- **重複請求防護** - 自動跳過相同參數的重複請求

### 🎯 優化亮點

#### 1. 請求取消 (AbortController)

```typescript
// 自動取消前一個請求，避免競態條件
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}
```

**解決的問題：**

- ❌ 快速輸入搜尋時，舊請求可能在新請求之後返回
- ✅ 確保只有最新請求的結果會被顯示

#### 2. 防抖搜尋修復

```typescript
// 問題：分離的 reset 和 fetch effect 導致使用過期的搜尋值
// 解決：合併成單一 effect，確保使用最新的 debouncedSearch
useEffect(() => {
  // Reset + Fetch 在同一個 effect 中
  setUsers([]);
  fetchUsers(); // 使用當前的 debouncedSearch
}, [debouncedSearch, userId]);
```

**修復的 Bug：**

- ❌ 輸入 "dev"，API 收到 "d"
- ✅ 輸入 "dev"，API 正確收到 "dev"

#### 3. 區分載入狀態

```typescript
isLoading; // 初始載入或搜尋
isLoadingMore; // 無限滾動載入更多
```

**UX 改善：**

- 初始載入：顯示 3 個 skeleton
- 載入更多：顯示 2 個 skeleton（列表下方）
- 用戶清楚知道當前狀態

#### 4. 錯誤處理和重試

```typescript
const { error, retry } = useUserList({ ... });

{error && (
  <ErrorBanner
    message={error.message}
    onRetry={retry}
  />
)}
```

**功能：**

- 捕獲所有 API 錯誤
- 提供 `retry()` 函數重試失敗的請求
- 自動忽略 AbortError（請求取消不算錯誤）

## 📖 使用方式

### 基本用法

```tsx
import { useUserList } from "@/hooks/use-user-list";

function FollowersPage() {
  const {
    users: followers,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    retry,
  } = useUserList({
    userId: "user-123",
    type: "followers",
    limit: 20, // optional, default: 20
  });

  // ... render logic
}
```

### 完整範例

```tsx
export default function FollowersPage() {
  const { userId } = useProfileData(username);
  const {
    users: followers,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    searchQuery,
    setSearchQuery,
    loadMore,
    retry,
  } = useUserList({ userId, type: "followers" });

  const sentinelRef = useInfiniteScroll(loadMore, hasMore, isLoading || isLoadingMore);

  return (
    <div>
      {/* Search Bar */}
      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Error State */}
      {error && <ErrorBanner message={error.message} onRetry={retry} />}

      {/* User List */}
      {!error && followers.map((user) => <UserCard key={user.userId} {...user} />)}

      {/* Initial Loading */}
      {isLoading && !isLoadingMore && (
        <div>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      )}

      {/* Load More Loading */}
      {isLoadingMore && (
        <div>
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && followers.length === 0 && (
        <EmptyState
          message={searchQuery ? `No results for "${searchQuery}"` : "No followers yet"}
        />
      )}

      {/* Infinite Scroll Sentinel */}
      {hasMore && !isLoading && !isLoadingMore && !error && <div ref={sentinelRef} />}
    </div>
  );
}
```

## 🔧 API Reference

### Parameters

```typescript
interface UseUserListOptions {
  userId: string | null; // 目標使用者 ID
  type: "followers" | "following"; // 列表類型
  limit?: number; // 每頁數量 (default: 20, max: 50)
}
```

### Return Values

```typescript
interface UseUserListReturn {
  // Data
  users: UserListItem[]; // 使用者列表
  hasMore: boolean; // 是否還有更多資料

  // Loading States
  isLoading: boolean; // 初始載入或搜尋中
  isLoadingMore: boolean; // 載入更多中

  // Error Handling
  error: Error | null; // 錯誤訊息
  retry: () => void; // 重試函數

  // Search
  searchQuery: string; // 當前搜尋字串
  setSearchQuery: (q: string) => void; // 設定搜尋字串

  // Pagination
  loadMore: () => Promise<void>; // 載入更多

  // Reset
  reset: () => void; // 重置所有狀態
}
```

### UserListItem Type

```typescript
interface UserListItem {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  karma: number;
  followedAt: string; // ISO timestamp
  isFollowing?: boolean; // 當前使用者是否 follow 此人
}
```

## ⚡ 性能優化

### 1. Debounce 搜尋

```typescript
// 使用者輸入 → 等待 300ms → 發送請求
// 快速輸入時，只有最後一次輸入會觸發請求
```

**效果：**

- 輸入 "alice" (5 個字元)
- 不使用 debounce：5 次 API 請求
- 使用 debounce：1 次 API 請求
- **節省 80% 請求**

### 2. 請求取消

```typescript
// 新請求觸發時自動取消舊請求
// 避免過期結果覆蓋新結果
```

**效果：**

- 避免 race condition
- 節省網路頻寬
- 確保 UI 顯示最新資料

### 3. 重複請求防護

```typescript
// 追蹤最後一次請求的參數
// 相同參數的請求會被自動跳過
```

**效果：**

- 避免不必要的重複請求
- 減少伺服器負擔

## 🐛 Bug 修復記錄

### Bug #1: 搜尋值不正確

**問題：**

```
使用者輸入: "dev"
API 收到:    "d"
```

**原因：**

```typescript
// 舊程式碼有兩個分離的 useEffect

// Effect 1: Reset when search changes
useEffect(() => {
  setUsers([]);
}, [debouncedSearch]);

// Effect 2: Auto-fetch when users is empty
useEffect(() => {
  if (users.length === 0) {
    loadMore(); // ❌ 使用過期的 debouncedSearch
  }
}, [users.length]);
```

**時間線：**

1. 輸入 "d" → debounce 300ms
2. `debouncedSearch = "d"`
3. Effect 1 觸發 → `users = []`
4. Effect 2 **立即觸發** → fetch("d") ❌
5. 使用者繼續輸入 "ev"
6. 已經有結果了，不會再 fetch

**解決方案：**

```typescript
// 合併成單一 useEffect
useEffect(() => {
  setUsers([]); // Reset
  fetchUsers(); // Fetch (使用最新的 debouncedSearch) ✅
}, [debouncedSearch]);
```

## 📊 使用範例

### 範例 1: Followers 頁面

```tsx
// src/app/u/[username]/followers/page.tsx
const {
  users: followers,
  isLoading,
  searchQuery,
  setSearchQuery,
} = useUserList({ userId, type: "followers" });
```

### 範例 2: Following 頁面

```tsx
// src/app/u/[username]/following/page.tsx
const { users: following, error, retry } = useUserList({ userId, type: "following" });
```

## 🔗 相關文件

- [UserContext](../contexts/USER_CONTEXT.md)
- [useInfiniteScroll](./use-infinite-scroll.md)
- [API: getUserList](../lib/README.md#getUserList)
- [Followers/Following Refactor Plan](../../plans/followers-following-refactor.md)

---

**最後更新：** 2026-02-20  
**維護者：** Backend Team
