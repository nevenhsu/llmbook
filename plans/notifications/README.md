# Notifications System - Implementation Plan

> **目標：** 完善 `/notifications` 頁面功能，新增 Follow 系統、@mention 功能、通知刪除、點擊跳轉，並提供 Preview 頁面。

---

## 現狀分析

### 已完成功能

| 功能 | 狀態 | 說明 |
|------|------|------|
| 通知列表 | 部分完成 | 基本 UI 已有，但類型定義不一致 |
| 已讀/未讀 | 完成 | 可標記單一或全部已讀 |
| NotificationBell | 完成 | Header 30 秒輪詢，顯示未讀數 |
| UPVOTE 通知 | 完成 | 文章被 upvote 時通知作者 |
| UPVOTE_COMMENT 通知 | 完成 | 評論被 upvote 時通知作者 |
| REPLY 通知 | 部分完成 | 只通知文章作者，不通知被回覆的評論者 |

### 待實作/待修復

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 類型不一致修復 | High | 前端 interface 與 DB schema 不符 |
| Follow 系統 | High | 全新功能，需 DB + UI + API |
| @mention 功能 | High | TipTap extension + 通知觸發 |
| Comment Reply 通知 | High | 通知被回覆的評論者 |
| 通知點擊跳轉 | High | 點擊通知導航到相關內容 |
| 刪除通知（軟刪除） | Medium | 目前無刪除功能 |
| 無限滾動分頁 | Medium | 目前限制 50 筆，無分頁 |
| Preview 頁面 | Medium | 用假資料預覽 UI |
| 移除 Archive 入口 | Low | 改為刪除功能 |

---

## 文檔索引

| 文檔 | 主題 | 依賴 |
|------|------|------|
| [01-database-schema.md](01-database-schema.md) | DB Schema 變更（Follow 表 + 通知軟刪除） | 無 |
| [02-notification-types.md](02-notification-types.md) | 通知類型定義與 TypeScript 介面統一 | 01 |
| [03-notification-page.md](03-notification-page.md) | 通知頁面重構（無限滾動、跳轉、刪除） | 01, 02 |
| [04-mention-system.md](04-mention-system.md) | @mention 功能（TipTap + API + 通知） | 01, 02 |
| [05-follow-system.md](05-follow-system.md) | Follow 系統（UI + API + 通知） | 01, 02 |
| [06-preview-page.md](06-preview-page.md) | Preview 頁面（假資料 UI 預覽） | 02, 03 |
| [07-notification-bell-popover.md](07-notification-bell-popover.md) | NotificationBell Popover 預覽 | 02, 03 |
| [08-notification-throttling.md](08-notification-throttling.md) | 通知節流與合併（Upvote 里程碑、發文限制） | 02, 05 |

---

## 實作順序

```
Phase 1: Database & Types
├── 01-database-schema.md  ← 先做 DB migration
└── 02-notification-types.md ← 統一類型定義

Phase 2: Core Features
├── 03-notification-page.md ← 重構通知頁面
├── 07-notification-bell-popover.md ← NotificationBell Popover
└── 08-notification-throttling.md ← 通知節流（可與其他並行）

Phase 3: @mention & Follow
├── 04-mention-system.md    ← @mention 功能
└── 05-follow-system.md     ← Follow 系統

Phase 4: Preview
└── 06-preview-page.md      ← Preview 頁面（最後做）
```

---

## 可複用的現有程式碼 (MUST REUSE)

> **重要：** 以下現有程式碼必須複用，避免重複實作（參考 refactor-audit.md 的教訓）

### Hooks

| Hook | 路徑 | 用途 |
|------|------|------|
| `useInfiniteScroll` | `src/hooks/use-infinite-scroll.ts` | **必須使用** - 無限滾動 |
| `useVote` | `src/hooks/use-vote.ts` | 投票邏輯（如需要） |
| `usePostInteractions` | `src/hooks/use-post-interactions.ts` | Save/Hide 邏輯（如需要） |

### UI Components

| Component | 路徑 | 用途 |
|-----------|------|------|
| `Avatar` | `src/components/ui/Avatar.tsx` | **必須使用** - 用戶頭像顯示 |
| `Timestamp` | `src/components/ui/Timestamp.tsx` | **必須使用** - 相對時間顯示 |
| `Skeleton` | `src/components/ui/Skeleton.tsx` | **必須使用** - 載入骨架 |

| `ResponsiveMenu` | `src/components/ui/ResponsiveMenu.tsx` | 下拉選單（如需要） |
| `SafeHtml` | `src/components/ui/SafeHtml.tsx` | **需擴展** - HTML 渲染 + mention 處理 |

### Lib Utilities

| Utility | 路徑 | 用途 |
|---------|------|------|
| `withAuth` | `src/lib/server/route-helpers.ts` | **必須使用** - API 認證 wrapper |
| `http.*` | `src/lib/server/route-helpers.ts` | **必須使用** - 標準化 API 回應 |
| `parseJsonBody` | `src/lib/server/route-helpers.ts` | **必須使用** - 解析 request body |
| `validateBody` | `src/lib/server/route-helpers.ts` | **必須使用** - 驗證必填欄位 |
| `PaginatedResponse` | `src/lib/pagination.ts` | **必須使用** - 分頁回應格式 |
| `getNextCursor` | `src/lib/pagination.ts` | **必須使用** - cursor 分頁 |
| `calculateHasMore` | `src/lib/pagination.ts` | **必須使用** - 判斷是否有更多 |
| `apiFetchJson` | `src/lib/api/fetch-json.ts` | 前端 API 呼叫（可選） |
| `ApiError` | `src/lib/api/fetch-json.ts` | API 錯誤處理（可選） |

### Types

| Type | 路徑 | 用途 |
|------|------|------|
| `PaginatedResponse<T>` | `src/lib/pagination.ts` | **必須使用** - API 回應格式 |
| 新增 `NotificationRow` | `src/types/notification.ts` | 新建立 - 通知類型定義 |

---

## 技術決策

| 決策項目 | 選擇 | 理由 |
|----------|------|------|
| 更新機制 | 30s 輪詢（維持現狀） | 簡單穩定，Realtime 留待未來 |
| 分頁方式 | Cursor-based 無限滾動 | 配合現有 `lib/pagination.ts` |
| 刪除方式 | 軟刪除（`deleted_at` 欄位） | 可追蹤、可恢復 |
| @mention 存儲 | 存 `user_id`（非 username） | 支援用戶改名 |
| Follow 儲存 | 獨立 `follows` 表 | 清晰的資料模型 |
| API 錯誤格式 | `http.*` helpers | 統一 JSON 格式（R-04） |
| API 認證 | `withAuth` wrapper | 統一認證邏輯（R-03） |

---

## 檔案變更總覽

### 新增檔案

```
src/
├── app/
│   ├── api/
│   │   ├── follows/
│   │   │   ├── route.ts              # POST (follow), DELETE (unfollow)
│   │   │   └── status/
│   │   │       └── route.ts          # GET (check status)
│   │   ├── mentions/
│   │   │   ├── suggestions/
│   │   │   │   └── route.ts          # GET (autocomplete)
│   │   │   ├── validate/
│   │   │   │   └── route.ts          # GET (validate username)
│   │   │   └── resolve/
│   │   │       └── route.ts          # POST (batch resolve user_id)
│   │   └── notifications/
│   │       └── [id]/
│   │           └── route.ts          # DELETE (soft delete)
│   └── preview/
│       └── notifications/
│           ├── page.tsx              # Preview 頁面
│           └── mock-data.ts          # 假資料
├── components/
│   ├── notification/
│   │   ├── NotificationItem.tsx      # 單一通知項目（複用 Avatar, Timestamp）
│   │   ├── NotificationList.tsx      # 通知列表（複用 useInfiniteScroll）
│   │   └── NotificationEmpty.tsx     # 空狀態
│   ├── follow/
│   │   └── FollowButton.tsx          # Follow/Unfollow 按鈕
│   └── tiptap-extensions/
│       └── mention/
│           ├── MentionExtension.ts   # TipTap extension
│           ├── MentionList.tsx       # 自動完成選單（複用 Avatar）
│           └── MentionInputRule.ts   # 手動輸入驗證
├── lib/
│   └── mention-parser.ts             # 解析 HTML 中的 mention
└── types/
    └── notification.ts               # 通知類型定義

supabase/
└── migrations/
    └── 00X_follows_and_notifications_v2.sql
```

### 修改檔案

```
src/
├── app/
│   ├── api/
│   │   ├── notifications/
│   │   │   └── route.ts              # 新增 cursor 分頁、排除軟刪除
│   │   ├── posts/
│   │   │   └── route.ts              # Follow 通知觸發、@mention 處理
│   │   └── posts/[id]/comments/
│   │       └── route.ts              # Comment reply 通知 + @mention
│   ├── notifications/
│   │   ├── page.tsx                  # 重構：使用新元件
│   │   └── archive/                  # 刪除整個目錄
│   └── profile/[username]/
│       └── page.tsx                  # 新增 FollowButton
├── components/
│   ├── tiptap-templates/simple/
│   │   └── simple-editor.tsx         # 加入 MentionExtension
│   └── ui/
│       └── SafeHtml.tsx              # 擴展：動態解析 mention
└── lib/
    └── notifications.ts              # 更新類型常數
```

### 刪除檔案

```
src/app/notifications/archive/        # 整個目錄刪除
```

---

## 命名規範 (MUST FOLLOW)

參考 R-14 hook 命名規範：

| 類型 | 命名規則 | 範例 |
|------|----------|------|
| Hooks | kebab-case | `use-infinite-scroll.ts` |
| Components | PascalCase | `NotificationItem.tsx` |
| Lib files | kebab-case | `mention-parser.ts` |
| API routes | kebab-case 目錄 | `api/mentions/suggestions/route.ts` |
| Types | PascalCase | `NotificationRow` |
| Constants | SCREAMING_SNAKE | `NOTIFICATION_TYPES` |

---

## 驗收標準

### Phase 1 完成標準

- [ ] `follows` 表已建立，有 RLS 政策
- [ ] `notifications` 表新增 `deleted_at` 欄位
- [ ] `src/types/notification.ts` 已建立
- [ ] 所有類型與 DB schema 一致
- [ ] `npm run build` 無錯誤

### Phase 2 完成標準

- [ ] 通知頁面使用 `useInfiniteScroll` hook
- [ ] 通知項目使用 `Avatar`, `Timestamp` 元件

- [ ] API 使用 `withAuth` 和 `http.*` helpers
- [ ] API 回應使用 `PaginatedResponse` 格式
- [ ] @mention 在評論和文章中可用
- [ ] @mention 觸發通知

### Phase 3 完成標準

- [ ] Follow 按鈕在個人頁面可用
- [ ] 追蹤者發文時會觸發通知
- [ ] 被追蹤時會收到通知
- [ ] Preview 頁面可正常顯示
- [ ] 所有新元件有複用現有 UI 元件

---

## 潛在問題與注意事項

### 1. SafeHtml 擴展的效能

`SafeHtml` 需要動態查詢 mention 的用戶資訊，可能影響效能：

**解決方案：**
- 加入 client-side cache（Map）
- 批量查詢（一次查詢所有 user_id）
- 考慮 SSR 時預先解析

### 2. 通知批量發送（追蹤者發文）

當用戶有大量追蹤者時，發文時批量建立通知可能很慢：

**解決方案：**
- Phase 1: 同步發送，限制最多 100 個通知
- 未來: 使用 background job / queue

### 3. TipTap Mention Extension 版本相容性

確認 `@tiptap/extension-mention` 與現有 TipTap 版本（3.19）相容。

### 4. 資料遷移（舊通知類型）

現有的通知使用 `UPVOTE`, `UPVOTE_COMMENT`, `REPLY`，需要遷移為新的 snake_case 格式。

```sql
-- 在 migration 中執行
UPDATE notifications SET type = 'post_upvote' WHERE type = 'UPVOTE';
UPDATE notifications SET type = 'comment_upvote' WHERE type = 'UPVOTE_COMMENT';
UPDATE notifications SET type = 'comment_reply' WHERE type = 'REPLY';
```

---

---

## 缺漏檢查清單

實作前請確認以下項目：

### 已在文檔中涵蓋

- [x] Follow 系統 DB schema
- [x] 通知軟刪除 (`deleted_at`)
- [x] 新通知類型定義
- [x] 無限滾動（使用 `useInfiniteScroll`）
- [x] @mention 自動完成
- [x] @mention 即時驗證
- [x] @mention 動態解析（用戶改名支援）
- [x] 通知點擊跳轉
- [x] Follow 通知（被追蹤 + 追蹤者發文）
- [x] Comment Reply 通知（回覆評論者）
- [x] Preview 頁面
- [x] 移除 Archive 功能
- [x] 資料遷移（舊通知類型轉換）
- [x] NotificationBell Popover（點擊顯示預覽）
- [x] Upvote 里程碑通知（1, 5, 10, 25, 50, 100...）
- [x] 追蹤者發文節流（最多 100 人 + 24h 冷卻）

### 實作時需額外注意

| 項目 | 說明 | 對應文檔 |
|------|------|----------|
| profiles 表欄位 | 新增 `follower_count`, `following_count` | 01 |
| RLS 政策 | `follows` 表需要正確的 RLS | 01 |
| Trigger | follow count 維護 trigger | 01 |
| TipTap 版本 | 確認 @tiptap/extension-mention 相容 3.19 | 04 |
| tippy.js 安裝 | mention dropdown 依賴 | 04 |
| isomorphic-dompurify | SafeHtml 已使用，確認支援 mention 屬性 | 04 |
| 批量通知效能 | 追蹤者發文時的通知數量限制 | 05 |

### 未涵蓋（未來可擴充）

- [ ] Realtime 即時通知（保持輪詢）
- [ ] 通知設定頁面（暫不實作）
- [ ] Follower/Following 列表頁面
- [ ] 追蹤 Board 功能
- [ ] Push Notification / Service Worker
- [ ] 通知批量刪除 UI

---

## 相關參考

- [webapp/_conventions.md](../webapp/_conventions.md) - 專案慣例
- [webapp/refactor-audit.md](../webapp/refactor-audit.md) - 重構審計（避免重蹈覆轍）
- [lib/pagination.ts](../../src/lib/pagination.ts) - 分頁工具
- [TipTap Mention](https://tiptap.dev/docs/editor/api/extensions/mention) - 官方文檔
