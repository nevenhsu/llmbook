# Webapp 重複代碼整合藍圖（不含實作）

> 目的：把目前重複邏輯「抽象成可重複用的 hook / context / component / lib」的設計寫清楚。

## 現況觀察（Repo 事實）

### 重複點 1：client 端呼叫 API / 錯誤處理分散

範例：`fetch('/api/votes')` 出現在多個地方，payload 也不一致：

- `src/components/feed/FeedContainer.tsx`
- `src/components/tag/TagFeed.tsx`
- `src/components/post/PostDetailVote.tsx`
- `src/components/profile/ProfilePostList.tsx`

此外：notifications polling、board create、username check、media upload 也各自做 try/catch / parse json / status handling。

### 重複點 2：投票 optimistic update 邏輯重複且不一致

- score delta 計算在各處手寫
- 有的會「toggle off」，有的會直接覆蓋 userVote
- 有的會在 error revert，有的只 log

### 重複點 3：API route handler 的 boilerplate

- `createClient(cookies())`
- auth check（未登入 401）
- `NextResponse.json({ error })` 統一格式

### 明顯的 contract 風險（建議先釘測試）

- `src/app/api/votes/route.ts` 讀 `{ postId, commentId, value }` 且 value 僅接受 `1 | -1`
  - `src/components/profile/ProfilePostList.tsx` 傳 `{ post_id: postId, value }`
  - `src/components/tag/TagFeed.tsx` 可能傳 `value: null`

## 目標（給實作者）

- 所有 client 端 API 呼叫都走同一層 typed wrapper（統一 status / json / error）
- optimistic update 規則集中（可測、可重用）
- API route 的 auth / error response boilerplate 抽到共用 helper
- 不改變功能行為的前提下，減少重複與修正 contract 不一致

## 建議新增的共用層（檔案規劃）

### A) client API wrapper

新增（建議）：

- `src/lib/api/fetch-json.ts`
  - `apiFetchJson<T>(input, init): Promise<T>`：
    - 自動 `Content-Type`
    - 非 2xx：讀 `text()` 或 `{ error }` 並 throw typed error
  - `ApiError`：包含 `status`, `message`, `details?`

### B) votes：單一 contract + optimistic helper

新增（建議）：

- `src/lib/api/votes.ts`
  - `votePost(postId: string, value: 1 | -1): Promise<{ score: number }>`
  - `voteComment(commentId: string, value: 1 | -1): Promise<{ score: number }>`
  - 明確規則：client 永遠送 `1 | -1`；toggle 由 server 判斷（同值再點即刪除）

- `src/lib/optimistic/vote.ts`
  - `applyVote({ score, userVote }, value): { score, userVote }`
  - `revertVote(...)`（或回傳 previous snapshot）

新增（建議 hook）：

- `src/hooks/use-vote-mutation.ts`
  - 封裝：loading、錯誤、呼叫 `votePost/voteComment`、reconcile server score

遷移目標：

- `src/components/feed/FeedContainer.tsx` 改用共用 vote helper
- `src/components/tag/TagFeed.tsx` 改用共用 vote helper
- `src/components/post/PostDetailVote.tsx` 改用共用 vote helper
- `src/components/profile/ProfilePostList.tsx` 修正 payload 並改用共用 vote helper

### C) notifications：polling/visibility 整合

新增（建議）：

- `src/lib/api/notifications.ts`
  - `listNotifications()`
  - `markNotificationsRead(ids: string[])`
  - `countUnread(notifications)` pure helper

- `src/hooks/use-notifications-unread.ts`
  - 封裝 polling、tab visibility refresh、logout 時清空

遷移目標：

- `src/components/notification/NotificationBell.tsx`
- `src/app/notifications/page.tsx`

### D) posts pagination：定義單一 cursor 規則

問題：`src/app/api/posts/route.ts` 的 `cursor` 同時被當 offset 與時間（`new Date(cursor)`）使用；`src/components/feed/FeedContainer.tsx` 用 `page=`。

建議先在文件定義「唯一正確的 pagination contract」，再實作：

- 選項 1（推薦）：明確分離參數
  - `offset`：number，用於 cached ranking（hot/rising 的 `.range()`）
  - `before`：ISO date string，用於 new/top 的 time-based pagination

- 選項 2：保留 `cursor`，但用 `cursorType` 或依 sort 決定解析方式（較容易踩雷）

新增（建議）：

- `src/lib/pagination.ts`
  - `buildPostsQueryParams({ sort, board, tag, author, includeArchived, limit, cursor })`
  - `parseCursorFromResponse(...)`

### E) server route utilities（減少 handler boilerplate）

新增（建議）：

- `src/lib/server/route-helpers.ts`
  - `getSupabaseServerClient()`：內部 `createClient(cookies())`
  - `requireUser(supabase)`：回傳 user 或 throw/return `NextResponse`
  - `jsonError(message, status)` / `jsonOk(data, headers?)`

注意：保持與現有 conventions 一致（參考 `plans/webapp/_conventions.md`）。

### F) env 使用一致化

已知：`src/app/api/media/upload/route.ts` 讀 `process.env.SUPABASE_STORAGE_BUCKET`。

建議：

- 一律用 `import { privateEnv } from '@/lib/env'` 取得 bucket
- 用測試把 env 使用固定住（避免未來又直接讀 `process.env`）

## 分階段交付（建議順序）

1) 先補 tests：把 votes contract、posts pagination contract 釘住（見 `docs/testing/WEBAPP_MODULE_TEST_PLAN.md`）
2) 落地 `src/lib/api/fetch-json.ts` + votes typed client
3) 全面遷移 votes 呼叫點（同時刪除重複 optimistic 計算）
4) notifications typed client + hook
5) posts pagination contract + FeedContainer 參數對齊
6) server route helpers（逐 route 遷移，不要一次大爆改）

## Done 定義（給實作者驗收）

- `fetch('/api/...')` 在 UI 層大幅減少（集中到 `src/lib/api/*`）
- `/api/votes` 只存在單一 payload 形狀（TypeScript type + tests 保護）
- optimistic vote 更新只有一份實作（pure helper + hook）
- posts pagination contract 有文件 + route tests + FeedContainer 對齊
