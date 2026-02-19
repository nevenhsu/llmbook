# P2b — 元件重構

> **優先順序：P2 — 中優先**  
> 重構過度龐大的元件、提取可複用 Hook、修正 prop drilling 問題。

---

## 重構項目 1：`ProfilePostList` → 提取 `usePaginatedList` Hook

### 問題描述

`src/components/profile/ProfilePostList.tsx`（481 行）內部有三套**完全相同**的分頁狀態模式（posts、comments、savedPosts），每套都有：

```typescript
const [items, setItems] = useState<T[]>(initialItems);
const [loading, setLoading] = useState(false);
const [hasMore, setHasMore] = useState(initialHasMore);
const [cursor, setCursor] = useState<string | null>(initialCursor);

const loadMore = async () => {
  if (loading || !hasMore) return;
  setLoading(true);
  try {
    const data = await fetchMore(cursor);
    setItems((prev) => [...prev, ...data.items]);
    setCursor(data.nextCursor);
    setHasMore(data.hasMore);
  } finally {
    setLoading(false);
  }
};
```

此外，`ProfilePostList` 中使用了手動的 window resize 偵測，但專案已有 `use-is-breakpoint` hook。

### 修正方案

**Step 1：建立 `src/hooks/use-paginated-list.ts`**

```typescript
import { useState, useCallback } from "react";

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PaginatedListOptions<T> {
  initialItems: T[];
  initialCursor: string | null;
  initialHasMore: boolean;
  fetcher: (cursor: string | null) => Promise<PaginatedResult<T>>;
}

export interface UsePaginatedListReturn<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * 通用分頁列表 Hook。
 * 管理 items、loading、hasMore、cursor 狀態，
 * 提供 loadMore 函式供外部（IntersectionObserver 或按鈕）觸發。
 */
export function usePaginatedList<T>({
  initialItems,
  initialCursor,
  initialHasMore,
  fetcher,
}: PaginatedListOptions<T>): UsePaginatedListReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [cursor, setCursor] = useState<string | null>(initialCursor);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const result = await fetcher(cursor);
      setItems((prev) => [...prev, ...result.items]);
      setCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor, fetcher]);

  return { items, loading, hasMore, loadMore };
}
```

**Step 2：重構 `ProfilePostList.tsx`**

```typescript
// 新寫法（簡化後）
const {
  items: posts,
  loading: postsLoading,
  hasMore: postsHasMore,
  loadMore: loadMorePosts,
} = usePaginatedList({
  initialItems: initialPosts,
  initialCursor: postsCursor,
  initialHasMore: postsHasMore,
  fetcher: async (cursor) => {
    const params = buildPostsQueryParams({ cursor, limit: PAGE_SIZE });
    return apiFetchJson(`/api/profile/${username}/posts?${params}`);
  },
});

// 同樣模式用於 comments 和 savedPosts
```

**Step 3：替換手動 breakpoint 偵測**

```typescript
// Before（手動）
const [isMobile, setIsMobile] = useState(false);
useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 768);
  checkMobile();
  window.addEventListener("resize", checkMobile);
  return () => window.removeEventListener("resize", checkMobile);
}, []);

// After（使用現有 hook）
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint";
const isMobile = !useIsBreakpoint("md");
```

---

## 重構項目 2：修正 `canModerate` Prop Drilling 問題

### 問題描述

```typescript
// src/components/feed/FeedContainer.tsx:118
<PostRow key={post.id} {...post} userId={userId} variant="card" />
// ❌ 缺少 canModerate prop

// src/components/post/PostRow.tsx:60
canModerate = false,  // 永遠是 false！
```

`PostRow` 有 `canModerate` prop，但 `FeedContainer` 從未傳遞它，導致 Board Feed 中的版主永遠無法看到管理選項。

`PostActionsWrapper`（子元件）正確地透過 `useBoardContext()` 取得 `isModerator`，但 `PostRow` 本身不用 context，造成不一致。

### 分析兩種修正方向

**選項 A：FeedContainer 傳遞 `canModerate`**

```typescript
// src/components/feed/FeedContainer.tsx
// 接收 canModerate prop 並向下傳遞
interface FeedContainerProps {
  posts: FeedPost[];
  userId?: string;
  canModerate?: boolean;  // 新增
  // ...
}

<PostRow key={post.id} {...post} userId={userId} canModerate={canModerate} variant="card" />
```

呼叫端（`/r/[slug]/page.tsx`）需傳遞 `canModerate={isModerator}`。

**選項 B：`PostRow` 使用 `useOptionalBoardContext()`（推薦）**

```typescript
// src/components/post/PostRow.tsx
import { useOptionalBoardContext } from "@/contexts/BoardContext";

export function PostRow({ canModerate: canModerateProp = false, ...props }: PostRowProps) {
  const boardCtx = useOptionalBoardContext();
  // Board Context 中的 isModerator 優先；沒有 context 時使用 prop
  const canModerate = boardCtx?.isModerator ?? canModerateProp;
  // ...
}
```

這個方案讓 `PostRow` 在 Board 頁面自動獲取版主狀態，無需修改所有呼叫端。

### 建議執行選項 B 的步驟

1. 打開 `src/components/post/PostRow.tsx`。
2. 引入 `useOptionalBoardContext`。
3. 在元件頂部從 context 取得 `isModerator`。
4. 將 `canModerate` 邏輯改為：`const canModerate = boardCtx?.isModerator ?? canModerateProp;`
5. 測試：以版主身份在 Board 頁面查看帖子，確認「More」選單出現版主選項。

---

## 重構項目 3：`PostActions.tsx` 的 4 個 loading state 合併

### 問題描述

```typescript
// src/components/post/PostActions.tsx（約 40-44 行）
const [isDeleting, setIsDeleting] = useState(false);
const [isUndeleting, setIsUndeleting] = useState(false);
const [isArchiving, setIsArchiving] = useState(false);
const [isUnarchiving, setIsUnarchiving] = useState(false);
```

四個布林 state 在邏輯上互斥（同時只有一個操作進行中），但用四個分開的 boolean 管理，每個操作都要 `setIsX(true)` / `setIsX(false)` 兩行。

### 修正方案

```typescript
type PostActionState = "idle" | "deleting" | "undeleting" | "archiving" | "unarchiving";
const [actionState, setActionState] = useState<PostActionState>("idle");

// 使用
const isLoading = actionState !== "idle";
const isDeleting = actionState === "deleting";

// 操作函式
const handleDelete = async () => {
  setActionState("deleting");
  try {
    await apiDelete(`/api/posts/${postId}`);
    onUpdate?.();
  } catch (err) {
    handleError(err);
  } finally {
    setActionState("idle");
  }
};
```

JSX 中按鈕的 disabled 狀態：

```typescript
// Before
disabled={isDeleting || isArchiving || isUnarchiving}

// After
disabled={isLoading}
```

---

## 重構項目 4：`CommentThread.tsx` 的 `fetchComments` useCallback 修正

### 問題描述

```typescript
// src/components/comment/CommentThread.tsx:44
const fetchComments = async () => { ... };  // 每次 render 都是新函式

useEffect(() => {
  fetchComments();
}, [postId, sort]);  // ESLint warning：缺少 fetchComments 依賴
```

### 修正方案

```typescript
import { useCallback } from "react";

const fetchComments = useCallback(async () => {
  // ... 原有邏輯不變
}, [postId, sort]); // 正確聲明依賴

useEffect(() => {
  fetchComments();
}, [fetchComments]); // 現在依賴 stable 的 memoized 函式
```

---

## 重構項目 5：`FeedContainer` 與 `ProfilePostList` 共用 `usePaginatedList`

### 問題描述

`FeedContainer` 和 `ProfilePostList` 都實現了相似的「載入更多」邏輯：

- cursor/offset 管理
- loading state
- hasMore 判斷
- `useInfiniteScroll` 整合

在完成 `usePaginatedList` hook（重構項目 1）後，`FeedContainer` 也應使用它。

### 修正步驟

1. 在 `FeedContainer` 中引入 `usePaginatedList`。
2. 將現有的 `posts/loading/hasMore/cursor` state 替換。
3. `loadMore` 函式由 hook 提供。
4. 確保 `useInfiniteScroll` 接收的 `loadMore` 是新 hook 提供的版本。

---

## 驗收標準

- [ ] `src/hooks/use-paginated-list.ts` 建立完成，並有型別文件。
- [ ] `ProfilePostList.tsx` 使用 `usePaginatedList`，程式碼行數減少至 250 行以下。
- [ ] `ProfilePostList.tsx` 使用 `useIsBreakpoint` 替換手動 resize listener。
- [ ] `FeedContainer` 使用 `usePaginatedList`。
- [ ] Board Feed 中的版主可以看到版主管理選項（`canModerate` 問題修正）。
- [ ] `PostActions.tsx` 使用單一 `actionState` 取代 4 個 boolean。
- [ ] `CommentThread.tsx` 的 `fetchComments` 用 `useCallback` 包裹。
- [ ] `pnpm test` 全部通過。
- [ ] 更新 `AGENTS.md` 的 Hooks 表格，加入 `usePaginatedList`。
- [ ] 在 `docs/hooks/` 下建立 `use-paginated-list.md` 文件。
