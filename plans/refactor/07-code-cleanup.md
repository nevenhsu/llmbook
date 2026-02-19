# P3b — 程式碼整潔

> **優先順序：P3 — 低優先**  
> 不影響功能，但影響程式碼可讀性和長期維護品質。

---

## 清理項目 1：`console.log` 清理

### 問題描述

生產代碼中散布 125+ 個 `console.log/debug/warn/error` 呼叫，會在瀏覽器 DevTools 中暴露內部 API 路徑、排序類型、診斷時間等資訊。

### 分類處理

**保留的 console（合法的錯誤記錄）：**

```typescript
// ✅ 保留 — 真實錯誤，幫助診斷生產問題
console.error("Failed to fetch posts:", error);
```

**移除的 console（診斷用 log）：**

```typescript
// ❌ 移除 — 開發診斷，不應在生產出現
console.log("[FeedContainer] Loading more posts, cursor:", cursor);
console.log("Sort type:", sortType);
console.debug("Rankings cache hit:", cacheKey);
```

### 執行步驟

**Step 1：列出所有 console 使用**

```bash
grep -rn "console\." src/ --include="*.ts" --include="*.tsx" | grep -v "// eslint-disable"
```

**Step 2：逐一決策**

對每一行，判斷是否屬於「真實錯誤記錄」：

- 在 catch 塊中記錄實際錯誤 → **保留**
- 記錄 API 參數、排序類型、計數等診斷資訊 → **移除**
- 記錄「到達了某個分支」等流程追蹤 → **移除**

**Step 3（可選）：引入條件日誌**

若有些 log 在開發階段有用但不應在生產出現，可以用環境變數條件：

```typescript
// 建立 src/lib/logger.ts
const isDev = process.env.NODE_ENV === "development";

export const logger = {
  log: (...args: unknown[]) => isDev && console.log(...args),
  warn: (...args: unknown[]) => isDev && console.warn(...args),
  error: (...args: unknown[]) => console.error(...args), // 錯誤永遠記錄
};
```

---

## 清理項目 2：`BoardContext.tsx` Import 順序修正

### 問題描述

```typescript
// src/contexts/BoardContext.tsx（約第 67 行）
// import 語句放在 export function 之後！

export function useOptionalBoardContext() { ... }  // 第 53 行

import { useOptionalUserContext } from "./UserContext"; // 第 67 行 ❌
```

### 修正步驟

1. 打開 `src/contexts/BoardContext.tsx`。
2. 找到位於檔案底部（或中間）的 import 語句。
3. 將所有 import 語句移到檔案頂部（在 `"use client"` 指令之後）。
4. 確保 import 順序符合慣例：

   ```typescript
   "use client";

   // 1. React 核心
   import { createContext, useContext, ... } from "react";

   // 2. 外部套件
   // （如有）

   // 3. 內部模組（絕對路徑）
   import { useOptionalUserContext } from "@/contexts/UserContext";

   // 4. 型別 import
   import type { Board } from "@/types/board";
   ```

---

## 清理項目 3：移除或整合空目錄

### 問題描述

```
src/utils/          ← 完全空白的目錄
```

### 修正步驟

**選項 A：直接刪除（推薦）**

```bash
# 確認目錄為空
ls -la src/utils/
# 若為空，刪除
rmdir src/utils/
```

**選項 B：整合至 `src/lib/`**

如果 `src/utils/` 是預留給工具函式用的，考慮將其功能整合到現有的 `src/lib/` 中，並在 `AGENTS.md` 中記錄哪類函式應放在 `lib/`。

---

## 清理項目 4：`FeedPost` 與 `PostRowProps` 型別重複

### 問題描述

```typescript
// src/lib/posts/query-builder.ts
export interface FeedPost {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  // ... 更多欄位
}

// src/components/post/PostRow.tsx
interface PostRowProps {
  id: string;
  title: string;
  score: number;
  commentCount: number;
  boardName: string;
  // ... 幾乎完全一樣的欄位
}
```

### 修正方案

讓 `PostRowProps` 繼承 `FeedPost`，只新增元件特有的 UI 相關 props：

```typescript
// src/components/post/PostRow.tsx
import type { FeedPost } from "@/lib/posts/query-builder";

interface PostRowProps extends FeedPost {
  // 僅元件特有的 props
  userId?: string;
  canModerate?: boolean;
  variant?: "card" | "compact" | "list";
  onUpdate?: () => void;
}
```

### 執行步驟

1. 閱讀 `FeedPost` 和 `PostRowProps` 的完整定義，確認欄位差異。
2. 識別 `PostRowProps` 中哪些欄位在 `FeedPost` 中不存在（元件特有）。
3. 修改 `PostRowProps` 使用 `extends FeedPost`，保留元件特有欄位。
4. 檢查是否有 `PostRowProps` 特有欄位需要加到 `FeedPost`（如果合理的話）。
5. 驗證所有使用 `PostRow` 的地方型別都仍然正確。

---

## 清理項目 5：`ranking.ts` 的 Import 位置

### 問題描述

（已在 `04-shared-lib-extraction.md` 中提及）

`src/lib/ranking.ts` 第 340 行有 import 放在檔案底部。

### 修正步驟

1. 打開 `src/lib/ranking.ts`。
2. 找到約第 340 行的 `import type { SupabaseClient } from "@supabase/supabase-js";`。
3. 剪下這行，貼到檔案頂部的 import 區塊中。

---

## 清理項目 6：`as unknown as` 強制轉型替換

### 問題描述

```typescript
// src/app/api/posts/route.ts:119
rawPosts = cachedPosts as unknown as RawPost[];

// src/app/page.tsx:52
const rawPosts = (Array.isArray(postData) ? (postData as unknown[]) : []).filter(isRawPost);
```

`query-builder.ts` 已有 `isRawPost` 型別保護函式，應統一使用。

### 修正方案

```typescript
// Before（危險的強制轉型）
rawPosts = cachedPosts as unknown as RawPost[];

// After（安全的型別保護）
import { isRawPost } from "@/lib/posts/query-builder";
rawPosts = (Array.isArray(cachedPosts) ? cachedPosts : []).filter(isRawPost);
```

### 執行步驟

1. 搜尋 `as unknown as` 的使用：
   ```bash
   grep -rn "as unknown as" src/ --include="*.ts" --include="*.tsx"
   ```
2. 對每個 `RawPost` 相關的轉型，改用 `isRawPost` filter。
3. 對其他型別的強制轉型，評估是否有更安全的替代方案。

---

## 執行建議

以上清理項目可**並行執行**（每個項目互不依賴），可以分配給不同人同時處理：

| 項目                       | 預估工時 | 可並行 |
| -------------------------- | -------- | ------ |
| console.log 清理           | 1-2h     | ✅     |
| BoardContext import        | 15min    | ✅     |
| 空目錄移除                 | 5min     | ✅     |
| FeedPost/PostRowProps 合併 | 1h       | ✅     |
| ranking.ts import 移動     | 5min     | ✅     |
| as unknown as 替換         | 30min    | ✅     |

---

## 驗收標準

- [ ] `pnpm build` 零警告（或警告數量減少）。
- [ ] `console.log` 診斷日誌清除，僅保留真實錯誤的 `console.error`。
- [ ] `BoardContext.tsx` 所有 import 在頂部。
- [ ] `src/utils/` 目錄已刪除或整合。
- [ ] `PostRowProps` 繼承 `FeedPost`，無重複欄位定義。
- [ ] `ranking.ts` import 在頂部。
- [ ] `as unknown as RawPost[]` 替換為 `isRawPost` filter。
- [ ] `pnpm test` 全部通過。
