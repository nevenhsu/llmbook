# P2a — 共享函式提取

> **優先順序：P2 — 中優先**  
> 將散落各處的重複邏輯提取為共享函式庫，提高可維護性和一致性。

---

## 提取項目 1：Sort 參數解析函式

### 問題描述

`src/app/page.tsx` 和 `src/app/r/[slug]/page.tsx` 各自定義了幾乎相同的 `toSortType()` 函式，用於將 URL query string 的 `sort` 參數轉換為型別安全的排序枚舉。

### 現況（兩個頁面各自定義）

```typescript
// src/app/page.tsx:21（主頁，有 "best" 選項）
function toSortType(raw: string | null): "hot" | "new" | "top" | "rising" | "best" {
  if (raw === "new" || raw === "top" || raw === "rising" || raw === "best") return raw;
  return "hot";
}

// src/app/r/[slug]/page.tsx:26（Board 頁，無 "best"）
function toSortType(raw: string | null): "hot" | "new" | "top" | "rising" {
  if (raw === "new" || raw === "top" || raw === "rising") return raw;
  return "hot";
}
```

### 修正方案

**Step 1：建立 `src/lib/routing/sort-params.ts`**

```typescript
/**
 * 所有合法的排序類型。
 * "best" 僅限首頁（全站最佳），Board 頁不使用。
 */
export type SortType = "hot" | "new" | "top" | "rising" | "best";
export type BoardSortType = Exclude<SortType, "best">;

/** 合法的時間範圍（用於 "top" 排序） */
export type TimeRange = "day" | "week" | "month" | "year" | "all";

const VALID_SORT_TYPES: SortType[] = ["hot", "new", "top", "rising", "best"];
const VALID_BOARD_SORT_TYPES: BoardSortType[] = ["hot", "new", "top", "rising"];
const VALID_TIME_RANGES: TimeRange[] = ["day", "week", "month", "year", "all"];

/**
 * 解析 URL query 的 sort 參數（包含 "best"，用於首頁）。
 * 無效值返回預設值 "hot"。
 */
export function toSortType(raw: string | string[] | null | undefined): SortType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_SORT_TYPES.includes(value as SortType)) {
    return value as SortType;
  }
  return "hot";
}

/**
 * 解析 URL query 的 sort 參數（不包含 "best"，用於 Board 頁）。
 * 無效值返回預設值 "hot"。
 */
export function toBoardSortType(raw: string | string[] | null | undefined): BoardSortType {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_BOARD_SORT_TYPES.includes(value as BoardSortType)) {
    return value as BoardSortType;
  }
  return "hot";
}

/**
 * 解析 URL query 的 timeRange 參數。
 * 無效值返回預設值 "week"。
 */
export function toTimeRange(raw: string | string[] | null | undefined): TimeRange {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && VALID_TIME_RANGES.includes(value as TimeRange)) {
    return value as TimeRange;
  }
  return "week";
}
```

**Step 2：更新呼叫端**

```typescript
// src/app/page.tsx — 刪除本地 toSortType，改 import
import { toSortType, toTimeRange } from "@/lib/routing/sort-params";

// src/app/r/[slug]/page.tsx — 刪除本地 toSortType，改 import
import { toBoardSortType } from "@/lib/routing/sort-params";
```

---

## 提取項目 2：POST_STATUS 常量

### 問題描述

Post 狀態字串 `"PUBLISHED"`, `"ARCHIVED"`, `"DELETED"` 分散在 10+ 個檔案中，全部是 magic string，沒有集中定義。若需要改名或新增狀態，需要全局搜尋替換。

### 受影響檔案（部分）

- `src/components/post/PostActions.tsx`
- `src/components/post/PostRow.tsx`
- `src/app/api/posts/route.ts`
- `src/app/api/posts/[id]/route.ts`
- `src/lib/posts/query-builder.ts`
- `src/types/` 相關型別

### 修正方案

**Step 1：建立 `src/types/post-status.ts`**

```typescript
/**
 * Post 狀態枚舉常量。
 * 與資料庫 posts.status 欄位的值對應。
 */
export const POST_STATUS = {
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  DELETED: "DELETED",
} as const;

export type PostStatus = (typeof POST_STATUS)[keyof typeof POST_STATUS];
```

**Step 2：更新所有使用點**

搜尋所有 `"PUBLISHED"`, `"ARCHIVED"`, `"DELETED"` 的使用點：

```bash
grep -rn '"PUBLISHED"\|"ARCHIVED"\|"DELETED"' src/
```

對每個找到的位置，替換為 `POST_STATUS.PUBLISHED` 等常量引用，並在頂部加入 import：

```typescript
import { POST_STATUS } from "@/types/post-status";

// Before
if (post.status === "ARCHIVED") { ... }

// After
if (post.status === POST_STATUS.ARCHIVED) { ... }
```

**Step 3：更新 `PostStatus` 型別引用**

確認現有的 `PostStatus` 型別（如果已存在）改為使用 `POST_STATUS` 派生，避免重複定義。

---

## 提取項目 3：整合 `ranking.ts` 重複函式

### 問題描述

`src/lib/ranking.ts` 中的 `getHotPostsFromCache()` 和 `getRisingPostsFromCache()` 結構 99% 相同：

```typescript
// 兩個函式的差異只有欄位名稱
// Hot: hot_rank, hot_score
// Rising: rising_rank, rising_score
```

### 修正方案

**在 `src/lib/ranking.ts` 中提取泛型函式：**

```typescript
type RankingType = "hot" | "rising";

interface RankingConfig {
  rankField: string;
  scoreField: string;
}

const RANKING_CONFIGS: Record<RankingType, RankingConfig> = {
  hot: { rankField: "hot_rank", scoreField: "hot_score" },
  rising: { rankField: "rising_rank", scoreField: "rising_score" },
};

/**
 * 從 post_rankings cache 表取得指定類型的排名帖子。
 * 內部實現，供 getHotPostsFromCache 和 getRisingPostsFromCache 使用。
 */
async function getCachedPostRankings(
  type: RankingType,
  options: { limit?: number; boardId?: string /* 其他共同參數 */ },
): Promise<FeedPost[]> {
  const config = RANKING_CONFIGS[type];
  const supabase = await createClient();

  let query = supabase
    .from("post_rankings")
    .select("..., posts(...)")
    .order(config.rankField, { ascending: true })
    .limit(options.limit ?? 20);

  if (options.boardId) {
    query = query.eq("board_id", options.boardId);
  }

  const { data, error } = await query;
  // ... 共同的錯誤處理和資料轉換
}

// 保留公開 API，但委托給泛型函式
export async function getHotPostsFromCache(options: CacheQueryOptions): Promise<FeedPost[]> {
  return getCachedPostRankings("hot", options);
}

export async function getRisingPostsFromCache(options: CacheQueryOptions): Promise<FeedPost[]> {
  return getCachedPostRankings("rising", options);
}
```

**注意**：實作時需先閱讀 `ranking.ts` 的完整代碼，確認兩個函式的實際參數和邏輯差異，確保泛型化後行為不變。

---

## 提取項目 4：修正 `ranking.ts` import 位置

### 問題描述

`src/lib/ranking.ts` 第 340 行有一個 import 語句放在檔案底部，違反 TypeScript/JavaScript 慣例（import 應在頂部）。

### 修正方案

```typescript
// src/lib/ranking.ts
// 找到約第 340 行的 import:
import type { SupabaseClient } from "@supabase/supabase-js";

// 將這個 import 移到檔案頂部，與其他 import 放在一起。
```

這個改動不影響功能（TypeScript 的 import 提升），純粹是程式碼風格修正。

---

## 驗收標準

- [ ] `src/lib/routing/sort-params.ts` 建立完成，兩個頁面使用共享函式。
- [ ] `src/types/post-status.ts` 建立完成，所有 magic string 替換為常量。
- [ ] `ranking.ts` 的重複函式整合，公開 API 不變。
- [ ] `ranking.ts` 的 import 移到頂部。
- [ ] `pnpm test` 全部通過。
- [ ] 功能驗證：首頁和 Board 頁的排序、Post 狀態顯示均正常。
