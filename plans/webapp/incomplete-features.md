# Webapp 未完成功能清單

> **目的：** 列出所有「只有 UI 沒有功能」的模組，供 Codex 逐項實作。
>
> **規則：** 本文檔不含任何程式碼。每個任務描述「現狀」、「期望行為」、「相關檔案」和「相關 API」。
>
> **約定：** 實作時遵守 `plans/webapp/_conventions.md` 與 `AGENTS.md` 的共用函式庫規範。

---

## 目錄

- [PA — Admin 系統與權限架構（全新）](#pa--admin-系統與權限架構全新)
- [P0 — 完全沒有後端整合（整頁 Mock）](#p0--完全沒有後端整合整頁-mock)
- [P1 — 按鈕/表單存在但沒有功能](#p1--按鈕表單存在但沒有功能)
- [P2 — 功能不完整或資料未連接](#p2--功能不完整或資料未連接)
- [P3 — 壞掉的連結與孤立元件](#p3--壞掉的連結與孤立元件)

---

## PA — Admin 系統與權限架構（全新）

> 目前系統完全沒有 site-wide admin 的概念。`profiles` 表沒有 role 欄位，沒有 admin 頁面，沒有 admin 權限檢查。以下是需要建立的基礎設施和功能。

### PA-1: 建立 admin_users 資料表

**現狀：**
- 沒有任何 admin 角色的概念
- 所有權限都是 board-level（owner / moderator）
- 沒有人可以跨 board 執行管理操作

**期望行為：**
- 建立獨立的 `admin_users` 資料表，與 `profiles` 分開
- 欄位：`user_id`（FK to auth.users）、`role`（如 `'admin'` | `'super_admin'`）、`created_at`
- RLS 政策：只有現有 admin 可以新增其他 admin（或只能透過 service role 操作）
- 第一個 admin 用 seed SQL 或 Supabase Dashboard 手動插入

**相關檔案：**
- 需要新建 migration：`supabase/migrations/xxx_admin_users.sql`

**需要新建的：**
- 資料表：`admin_users`
- 共用函式：`isAdmin(userId)` 或 `isSiteAdmin(userId)` 放在 `src/lib/admin.ts`

---

### PA-2: Admin 權限檢查共用函式

**現狀：**
- 不存在

**期望行為：**
- 在 `src/lib/` 建立 admin 權限檢查函式
- 提供 `isAdmin(supabase, userId): Promise<boolean>` 函式
- 所有需要 admin 權限的 API route 都使用此函式
- 可以同時提供 middleware 層級的檢查（可選）

**相關檔案：**
- 需要新建：`src/lib/admin.ts`

---

### PA-3: Board Archive 改為 admin-only

**現狀：**
- Board archive（soft delete）目前只有 board owner 可以操作
- API `DELETE /api/boards/[slug]` 檢查 `isBoardOwner()`
- BoardSettingsForm 的 Danger Zone tab 只對 `userRole === 'owner'` 顯示

**期望行為：**
- Board archive 改為只有 site admin 可以操作
- API `DELETE /api/boards/[slug]` 改為檢查 `isAdmin()` 取代 `isBoardOwner()`
- BoardSettingsForm 的 Danger Zone tab 只對 admin 顯示（需要傳入 `isAdmin` prop）
- Board owner 不再能自行 archive board

**相關檔案：**
- `src/app/api/boards/[slug]/route.ts`（DELETE handler，目前第 131 行檢查 `isBoardOwner`）
- `src/components/board/BoardSettingsForm.tsx`（Danger Zone tab，目前用 `userRole === 'owner'` 控制顯示）
- `src/app/r/[slug]/settings/page.tsx`（需要查詢並傳入 isAdmin 狀態）
- `src/lib/admin.ts`（PA-2 建立的共用函式）

---

### PA-4: Board Unarchive 功能（目前不存在）

**現狀：**
- 一旦 board 被 archive，無法逆轉
- 沒有 unarchive 的 API endpoint
- Archive 頁面沒有 unarchive 按鈕

**期望行為：**
- 只有 admin 可以 unarchive board
- 在 `/r/archive` 頁面，admin 可以看到每個 archived board 的「Unarchive」按鈕
- 或在 archived board 的頁面上方，admin 可以看到「Unarchive this board」選項
- API：在 `PATCH /api/boards/[slug]` 加入 `is_archived: false` 的處理，需 admin 權限檢查
- Unarchive 後恢復正常功能（可發文、可留言、可加入）

**相關檔案：**
- `src/app/api/boards/[slug]/route.ts`（PATCH handler）
- `src/app/r/archive/page.tsx`（需要加入 Unarchive 按鈕，僅 admin 可見）
- `src/app/r/[slug]/page.tsx`（archived banner 上加 Unarchive 選項，僅 admin）

---

### PA-5: Post 刪除 API（作者自刪）

**現狀：**
- 完全沒有刪除貼文的 API endpoint
- `src/app/api/posts/[id]/route.ts` 只有 GET handler
- RLS 有 `"Users can delete their posts"` 政策（`auth.uid() = author_id`），但沒有 API 使用它
- PostActions 的 More 選單也不存在（見 P1-3）

**期望行為：**
- 在 `src/app/api/posts/[id]/route.ts` 加入 DELETE handler
- 只有作者可以刪除自己的貼文
- 刪除方式：硬刪除（真的從 DB 移除）或軟刪除（設定 status = 'DELETED'，body 替換為 '[deleted]'）— 建議軟刪除以保留留言脈絡
- 刪除後相關的 votes、media 等也要清理（或由 DB cascade 處理）

**相關檔案：**
- `src/app/api/posts/[id]/route.ts`（加入 DELETE handler）
- `supabase/schema.sql`（posts 表已有 `status` 欄位，預設 'PUBLISHED'）

---

### PA-6: Post Archive 功能（admin/moderator 可操作）

**現狀：**
- 沒有任何 post archive 的概念
- Moderator 的 `manage_posts` 權限存在於 DB 但從未被任何程式碼檢查或使用（dead code）
- Board moderator 無法對貼文進行任何管理操作

**期望行為：**
- Admin 和 board moderator（有 `manage_posts` 權限）可以 archive 貼文
- Archive 是軟刪除：設定 `status = 'ARCHIVED'`，貼文仍然存在但從 feed 中隱藏
- Archived 貼文的直接連結仍可訪問，但顯示「This post has been archived by moderators」的提示
- API：在 `PATCH /api/posts/[id]` 加入 `status: 'ARCHIVED'` 的處理
- 權限檢查：`isAdmin(userId)` 或 `canManageBoardPosts(boardId, userId)`（需要新函式或啟用現有的 `manage_posts` 檢查）

**相關檔案：**
- `src/app/api/posts/[id]/route.ts`（加入 PATCH handler）
- `src/lib/board-permissions.ts`（啟用 `manage_posts` 權限檢查）
- `src/lib/admin.ts`（PA-2 建立的共用函式）
- `src/app/api/posts/route.ts`（GET handler 需要過濾掉 archived 貼文）

---

### PA-7: 修正 Board Moderator 權限 — manage_posts 和 manage_settings 是 dead code

**現狀：**
- `board_moderators` 表有 `permissions` JSONB 欄位，包含 `manage_posts`、`manage_users`、`manage_settings`
- 但只有 `manage_users` 被實際檢查過（在 ban 管理中）
- `manage_posts`：從未被任何程式碼檢查，moderator 不能管理貼文
- `manage_settings`：`canManageBoard()` 函式存在但從未被呼叫，PATCH API 讓所有 moderator 都能改設定
- BoardSettingsForm UI 中有權限編輯器可以勾選這三個權限，但勾不勾都沒有實際效果

**期望行為：**
- `manage_posts`：與 PA-6 一起啟用。有此權限的 moderator 可以 archive 其 board 中的貼文
- `manage_settings`：PATCH `/api/boards/[slug]` 應使用 `canManageBoard()` 函式檢查，而非只檢查是否為 moderator
- 權限編輯器的勾選要真正產生效果

**相關檔案：**
- `src/lib/board-permissions.ts`（`canManageBoard` 已存在但未使用）
- `src/app/api/boards/[slug]/route.ts`（PATCH handler，第 39 行用 `getUserBoardRole`，應改用 `canManageBoard`）

---

## P0 — 完全沒有後端整合（整頁 Mock）

### P0-1: 通知頁面 — 全部是假資料

**現狀：**
- `/notifications` 頁面內有一個 `INITIAL_NOTIFICATIONS` 靜態陣列，包含 4 筆假通知（假用戶名如 `tech_enthusiast`、`design_pro`）
- 「Load more」按鈕用 `setTimeout` 模擬延遲，然後產生隨機假資料
- 「Mark all as read」、「Mark as read」、「Hide」都只改 local state，不呼叫任何 API
- 「Notification settings」連結指向 `/settings/notifications`，該頁面不存在

**期望行為：**
- 從 `/api/notifications` GET 取得真實通知列表
- 「Mark as read」呼叫 `/api/notifications` PATCH
- 「Mark all as read」批次呼叫 PATCH
- 「Hide」應該刪除或標記通知為隱藏（需要後端支援）
- 「Load more」用真正的分頁參數（offset / cursor）
- 移除所有 hardcoded 假資料

**相關檔案：**
- `src/app/notifications/page.tsx`
- `src/app/api/notifications/route.ts`（API 已存在，支援 GET 和 PATCH）

**備註：** API route 已經有 GET（取得通知）和 PATCH（標記已讀）功能，只需要前端接上。

---

### P0-2: 通知封存頁面 — 全部是假資料

**現狀：**
- `/notifications/archive` 頁面有 `ARCHIVED_NOTIFICATIONS` 靜態陣列，3 筆假資料
- `loadMore` 同樣用 `setTimeout` 產生假資料
- `hideNotification` 只改 local state

**期望行為：**
- 從 API 取得已封存的通知（可能需要在 GET 加上 `?archived=true` 參數）
- 分頁功能用真實的 offset / cursor
- 操作（隱藏、刪除）要呼叫 API

**相關檔案：**
- `src/app/notifications/archive/page.tsx`
- `src/app/api/notifications/route.ts`

---

## P1 — 按鈕/表單存在但沒有功能

### P1-1: PostActions「Save」按鈕未接上 API

**現狀：**
- `PostActions` 元件定義了 `onSave` 為 optional prop
- 所有父元件（`PostRow`、Post Detail 頁面）都沒有傳入 `onSave`
- 按鈕點擊後 `onSave?.()` 等於什麼都不做
- API route `/api/saved/[postId]` 已存在且功能完整（POST 儲存、DELETE 取消儲存）

**期望行為：**
- 點擊「Save」呼叫 `POST /api/saved/{postId}`
- 已儲存的貼文顯示為「Saved」狀態（需從後端取得使用者的已儲存清單）
- 再次點擊呼叫 `DELETE /api/saved/{postId}` 取消儲存
- 需要 optimistic update

**相關檔案：**
- `src/components/post/PostActions.tsx`
- `src/components/post/PostRow.tsx`
- `src/app/posts/[id]/page.tsx`
- `src/app/api/saved/[postId]/route.ts`（已完成）

---

### P1-2: PostActions「Hide」按鈕未接上 API

**現狀：**
- 與 Save 按鈕同樣的問題：`onHide` optional prop 從未被傳入
- API route `/api/hidden/[postId]` 已存在（POST 隱藏、DELETE 取消隱藏）

**期望行為：**
- 點擊「Hide」呼叫 `POST /api/hidden/{postId}`
- 隱藏的貼文從 Feed 中消失（或顯示「已隱藏」提示，可撤銷）
- 需要 optimistic update

**相關檔案：**
- `src/components/post/PostActions.tsx`
- `src/app/api/hidden/[postId]/route.ts`（已完成）

---

### P1-3: PostActions「More」選單 — 沒有 handler，沒有下拉選單

**現狀：**
- PostActions 有一個 MoreHorizontal icon 按鈕，但沒有 `onClick`、沒有下拉選單
- Report、Edit、Delete 功能完全不存在（沒有 UI，沒有 handler，沒有 API）

**期望行為：**
- 點擊「...」打開下拉選單，包含：
  - Report（檢舉）— 需要新的 API
  - Edit（作者才能看到）— 導向編輯頁面或開啟編輯模式
  - Delete（作者才能看到）— 確認後呼叫 `DELETE /api/posts/{id}`
- Edit 和 Delete 只對貼文作者顯示
- 版主可以看到額外的 Remove 選項

**相關檔案：**
- `src/components/post/PostActions.tsx`
- `src/app/api/posts/[id]/route.ts`（已有 DELETE handler）

**需要新建的 API：**
- `/api/posts/[id]/report`（檢舉貼文）

---

### P1-4: PostActions「Comments」按鈕不可點擊

**現狀：**
- 顯示留言數量的按鈕（MessageSquare icon）沒有 `onClick`
- 在 Feed 中點擊應該導向貼文留言區

**期望行為：**
- 在 Feed 列表中：點擊導向 `/posts/{id}#comments`
- 在貼文詳情頁中：滾動到留言區

**相關檔案：**
- `src/components/post/PostActions.tsx`

---

### P1-5: CommentItem「More」選單 — 沒有功能

**現狀：**
- 每則留言都有一個 MoreHorizontal icon 按鈕，但沒有 `onClick`、沒有下拉選單
- 留言的 Edit、Delete、Report 功能完全不存在

**期望行為：**
- 點擊「...」打開下拉選單，包含：
  - Edit（留言作者才能看到）— 開啟行內編輯模式
  - Delete（留言作者才能看到）— 確認後呼叫 `DELETE /api/comments/{id}`
  - Report — 需要新的 API
- 版主可以看到 Remove 選項

**相關檔案：**
- `src/components/comment/CommentItem.tsx`
- `src/app/api/comments/[id]/route.ts`（已有 PATCH 和 DELETE handler）

---

### P1-6: ProfilePostList 投票只是 console.log

**現狀：**
- `ProfilePostList` 的 `handleVote` 函式內容為 `console.log("Vote:", postId, value)`
- 有明確的 TODO 註解：`// TODO: Implement vote logic`
- 在使用者個人頁面 `/u/[username]` 的貼文列表中，點擊投票沒有任何效果

**期望行為：**
- 呼叫 `POST /api/votes` 與其他地方一致
- 使用 optimistic update
- 可以參考 `FeedContainer.tsx` 或 `PostDetailVote.tsx` 的投票邏輯

**相關檔案：**
- `src/components/profile/ProfilePostList.tsx`（第 14-16 行）
- `src/app/api/votes/route.ts`（已完成）

---

### P1-7: 使用者個人頁面「Follow」按鈕沒有功能

**現狀：**
- `/u/[username]` 頁面有一個 `<button>Follow</button>`，沒有 `onClick`
- 沒有 Follow 相關的 API route
- 沒有 followers 資料表

**期望行為：**
- 點擊 Follow 呼叫 API 追蹤該用戶
- 再次點擊 Unfollow
- 追蹤者數量即時更新
- 需要建立 `user_follows` 資料表和對應的 API route

**相關檔案：**
- `src/app/u/[username]/page.tsx`

**需要新建的：**
- 資料表：`user_follows`（follower_id, following_id, created_at）
- API：`/api/users/[userId]/follow`（POST 追蹤、DELETE 取消追蹤）

---

### P1-8: 使用者個人頁面「Followers」數量 hardcoded 為 0

**現狀：**
- 側邊欄顯示「0 Followers」，這個數字是寫死的，不從資料庫取得

**期望行為：**
- 從資料庫查詢實際的追蹤者數量
- 與 P1-7 Follow 功能一起實作

**相關檔案：**
- `src/app/u/[username]/page.tsx`

---

### P1-9: 使用者個人頁面「Comments」分頁沒有資料

**現狀：**
- 點擊「Comments」tab 會導向 `?tab=comments`
- 但頁面沒有任何查詢邏輯處理 `tab === "comments"` 的情況
- 貼文列表會是空的

**期望行為：**
- 當 tab 為 comments 時，查詢該使用者的所有留言
- 顯示留言列表（包含所屬貼文的標題和連結）

**相關檔案：**
- `src/app/u/[username]/page.tsx`

---

### P1-10: 使用者個人頁面「Hidden」分頁沒有資料

**現狀：**
- 點擊「Hidden」tab 會導向 `?tab=hidden`
- 沒有查詢邏輯，永遠是空的
- 只在查看自己的個人頁面時應該出現

**期望行為：**
- 當 tab 為 hidden 時，查詢 `hidden_posts` 資料表
- 僅本人可見
- 顯示被隱藏的貼文列表，並提供「Unhide」操作

**相關檔案：**
- `src/app/u/[username]/page.tsx`
- `src/app/api/hidden/[postId]/route.ts`（已完成）

---

### P1-11: BoardInfoCard 側邊欄「Join」按鈕沒有功能

**現狀：**
- `BoardInfoCard` 底部有一個 `<button>Join / Joined</button>`，沒有 `onClick`
- 真正功能完整的 `JoinButton` 元件存在，但 `BoardInfoCard` 沒有使用它
- API `/api/boards/[slug]/join` 已完成

**期望行為：**
- 將 `BoardInfoCard` 底部的 button 替換為 `JoinButton` 元件
- 或者在 button 上加入呼叫 `/api/boards/[slug]/join` 的 handler

**相關檔案：**
- `src/components/board/BoardInfoCard.tsx`（第 66-68 行）
- `src/components/board/JoinButton.tsx`（已完成，可直接使用）

---

### P1-12: CreatePostForm「Add tags」按鈕沒有功能

**現狀：**
- 發文表單有一個「Add tags」按鈕，沒有 `onClick`
- State 中有 `tagIds` 陣列，但沒有任何 UI 可以填入值
- 標籤選擇功能完全不存在

**期望行為：**
- 點擊「Add tags」打開標籤選擇器（下拉或 modal）
- 從 `/api/tags` 取得可用標籤列表
- 已選標籤顯示為 badge，可移除
- 送出貼文時將 `tagIds` 一起送出

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx`
- `src/app/api/tags/route.ts`（已完成）

---

### P1-13: CreatePostForm「Save Draft」與「Drafts」按鈕沒有功能

**現狀：**
- 「Save Draft」按鈕沒有 `onClick`
- Header 區域有一個「Drafts」按鈕也沒有 `onClick`
- 沒有草稿相關的 API 或資料表

**期望行為：**
- 「Save Draft」將目前表單內容儲存到後端或 localStorage
- 「Drafts」打開草稿列表，可以載入之前的草稿
- 需要決定儲存方式：localStorage（簡單）或後端資料表（完整）

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx`

**需要新建的（如果用後端方案）：**
- 資料表：`post_drafts`
- API：`/api/drafts`

---

### P1-14: CreatePostForm「Link」分頁的 URL 輸入未綁定 state

**現狀：**
- Link 分頁有一個 URL input，但沒有 `value` 和 `onChange`
- `handleSubmit` 會送出 `postType: 'link'` 但不會帶上 `linkUrl`
- 後端 API 驗證 link post 需要 `linkUrl`，所以 Link 類型的貼文必定失敗

**期望行為：**
- URL input 綁定到 state
- 送出時包含 `linkUrl` 欄位
- 可以考慮加入 URL 預覽（Open Graph preview）

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx`
- `src/app/api/posts/route.ts`

---

### P1-15: CreatePostForm Poll 的 duration 選擇器沒有送出

**現狀：**
- Poll 分頁有 duration selector，`pollDuration` state 存在
- 但 `handleSubmit` 沒有將 duration 送到 API
- 後端也沒有處理 poll duration 的邏輯

**期望行為：**
- 送出 poll 時包含 duration
- 後端根據 duration 計算 `expires_at` 並存入 `poll_options` 或 `posts` 表
- 前端 `PollDisplay` 根據 `expires_at` 判斷是否已過期

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx`
- `src/app/api/posts/route.ts`
- `src/components/post/PollDisplay.tsx`

---

### P1-16: 搜尋結果中的「Join」按鈕沒有功能

**現狀：**
- 搜尋頁面的 Communities 結果中，每個社群旁有 `<button>Join</button>`，沒有 `onClick`

**期望行為：**
- 使用 `JoinButton` 元件或呼叫 `/api/boards/[slug]/join`

**相關檔案：**
- `src/app/search/page.tsx`
- `src/components/board/JoinButton.tsx`（已完成）

---

### P1-17: 搜尋結果中的投票沒有功能

**現狀：**
- 搜尋頁面的 Posts 結果中，VotePill 的 `onVote` 是 `() => {}`（空函式）

**期望行為：**
- 與 Feed 一致，呼叫 `POST /api/votes`
- 使用 optimistic update

**相關檔案：**
- `src/app/search/page.tsx`
- `src/app/api/votes/route.ts`（已完成）

---

### P1-18: Login 頁面「Forgot Password」連結指向不存在的頁面

**現狀：**
- 連結指向 `/forgot-password`，該頁面不存在，會 404

**期望行為：**
- 建立 `/forgot-password` 頁面
- 使用 `supabase.auth.resetPasswordForEmail()` 發送重設密碼信
- 建立 `/reset-password` 頁面處理 reset token 的回調

**相關檔案：**
- `src/app/login/login-form.tsx`

**需要新建的：**
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`（或用 Supabase 預設的 callback）

---

### P1-19: UserMenu「Display Mode」按鈕沒有功能

**現狀：**
- UserMenu 下拉選單有「Display Mode」按鈕，沒有 `onClick`
- `ThemeToggle` 元件已經存在且功能完整（讀寫 localStorage、切換 `data-theme`）
- 但 `ThemeToggle` 沒有被整合到任何地方

**期望行為：**
- 將「Display Mode」按鈕替換為 `ThemeToggle` 元件
- 或讓按鈕呼叫相同的主題切換邏輯

**相關檔案：**
- `src/components/layout/UserMenu.tsx`
- `src/components/ui/ThemeToggle.tsx`（已完成，直接使用）

---

## P2 — 功能不完整或資料未連接

### P2-1: Feed 沒有分頁 / 無限滾動

**現狀：**
- `FeedContainer` 只渲染 `initialPosts`（從 server 傳入的初始資料）
- 沒有「Load more」按鈕、沒有 infinite scroll、沒有 page 參數
- 使用者只能看到第一批貼文

**期望行為：**
- 實作 infinite scroll（使用 IntersectionObserver）或「Load more」按鈕
- 傳入分頁參數（offset / cursor）給 `/api/posts`
- 新貼文追加到現有列表後方

**相關檔案：**
- `src/components/feed/FeedContainer.tsx`
- `src/app/api/posts/route.ts`

---

### P2-2: Board 頁面的 Feed 排序無效

**現狀：**
- `FeedSortBar` 在 Board 頁面使用 `<Link>` 模式，點擊會改變 URL（如 `?sort=hot`）
- 但 Board 頁面是 server component，查詢固定用 `order("created_at", { ascending: false })`
- URL 的 sort 參數被完全忽略，貼文永遠按建立時間排列

**期望行為：**
- Board 頁面讀取 URL 的 `sort` 和 `t` 參數
- 根據參數套用對應的排序邏輯（hot/new/top/rising）
- 可參考首頁的實作方式

**相關檔案：**
- `src/app/r/[slug]/page.tsx`
- `src/components/feed/FeedSortBar.tsx`
- `src/lib/ranking.ts`

---

### P2-3: 首頁和 Board 頁面的 userVote 未預載

**現狀：**
- Feed 中每個貼文的 `userVote` 都是 `null`
- 即使使用者已經投過票，UI 也不會顯示投票狀態
- 點擊投票可以正常運作，但重新整理後狀態消失

**期望行為：**
- 如果使用者已登入，查詢 `votes` 表取得該使用者對所有顯示中貼文的投票紀錄
- 將 `userVote` 正確傳入每個 `PostRow`

**相關檔案：**
- `src/app/page.tsx`
- `src/app/r/[slug]/page.tsx`
- `src/components/feed/FeedContainer.tsx`

---

### P2-4: RightSidebar「Recent Posts」完全是假資料

**現狀：**
- 右側邊欄的「Recent Posts」是兩筆 hardcoded 假貼文
- 「Clear」按鈕沒有 `onClick`
- 假貼文不是 `<Link>`，只有 `cursor-pointer` 的 div

**期望行為：**
- 從後端取得最近的貼文（可以用 server component 查詢）
- 每筆貼文連結到 `/posts/{id}`
- 「Clear」按鈕考慮移除或改為其他功能

**相關檔案：**
- `src/components/layout/RightSidebar.tsx`

---

### P2-5: UserMenu Karma 數字 hardcoded 為「1 karma」

**現狀：**
- 永遠顯示「1 karma」，不管實際 karma 多少
- Profile 資料表中有 `karma` 欄位

**期望行為：**
- 從 profile 資料中讀取真實的 karma 數值
- profile 資料已在 `layout.tsx` 中取得，需要傳遞到 UserMenu

**相關檔案：**
- `src/components/layout/UserMenu.tsx`
- `src/app/layout.tsx`

---

### P2-6: MobileSearchOverlay 搜尋不會呼叫 API

**現狀：**
- 手機版搜尋 overlay 只有 input UI
- 輸入任何內容永遠顯示「No results」
- 原始碼有註解：`"Results area — wired in webapp Phase 5"`

**期望行為：**
- 使用與 `SearchBar` 相同的邏輯，呼叫 `/api/search` 並顯示結果
- 或者直接 reuse `SearchBar` 的搜尋邏輯

**相關檔案：**
- `src/components/search/MobileSearchOverlay.tsx`
- `src/components/search/SearchBar.tsx`（desktop 版已完成，可參考）
- `src/app/api/search/route.ts`（已完成）

---

### P2-7: Post Detail 頁面側邊欄 member/online 數字是假的

**現狀：**
- 貼文詳情頁右側顯示「1.2k Members」和「42 Online」
- 這兩個數字是 hardcoded 字串

**期望行為：**
- Members 數量從 `board.member_count` 取得
- Online 數量可以暫時移除或標為 placeholder（需要 presence 功能才能做到真正的在線人數）

**相關檔案：**
- `src/app/posts/[id]/page.tsx`

---

### P2-8: Tag 頁面的貼文列表太簡陋

**現狀：**
- `/tags/[slug]` 頁面只顯示貼文標題和 body 片段
- 沒有投票、沒有作者資訊、沒有所屬 board、沒有分數

**期望行為：**
- 使用 `PostRow` 元件或類似的完整貼文卡片
- 包含投票、作者、board 名稱、留言數等資訊

**相關檔案：**
- `src/app/tags/[slug]/page.tsx`
- `src/components/post/PostRow.tsx`

---

## P3 — 壞掉的連結與孤立元件

### P3-1: 移除 /popular 連結

**現狀：**
- `DrawerSidebar` 和 `MobileBottomNav` 都有連結到 `/popular`
- 該頁面不存在，會 404
- 首頁已有 Hot 排序功能，/popular 不需要

**期望行為：**
- 從 `DrawerSidebar` 移除 Popular 連結
- 從 `MobileBottomNav` 移除 Popular 連結

**相關檔案：**
- `src/components/layout/DrawerSidebar.tsx`
- `src/components/layout/MobileBottomNav.tsx`

---

### P3-2: /about 連結指向不存在的頁面

**現狀：**
- `DrawerSidebar` 底部有「About Persona Sandbox」連結指向 `/about`
- 該頁面不存在

**期望行為：**
- 建立簡單的 `/about` 靜態頁面
- 或暫時移除連結

**相關檔案：**
- `src/components/layout/DrawerSidebar.tsx`

---

### P3-3: BoardLayout 管理連結沒有權限檢查（手機版）

**現狀：**
- 手機版的三點選單顯示「Members & Bans」和「Board Settings」連結給所有使用者
- 雖然目標頁面有權限檢查，但不應該讓非管理者看到這些連結

**期望行為：**
- 根據使用者角色（owner/moderator）決定是否顯示管理連結
- 非管理者不應看到這些選項

**相關檔案：**
- `src/components/board/BoardLayout.tsx`

---

### P3-4: 搜尋頁面 People 結果沒有連結到個人頁面

**現狀：**
- 搜尋 People 的結果只顯示文字（名稱），沒有 `<Link>` 到 `/u/[username]`
- Persona 結果有連結到 `/p/[slug]`，但一般使用者沒有

**期望行為：**
- 每個人物結果都應該是可點擊的連結到 `/u/[username]`

**相關檔案：**
- `src/app/search/page.tsx`

---

### P3-5: NotificationBell 沒有即時更新

**現狀：**
- `NotificationBell` 只在元件 mount 時 fetch 一次
- 之後不會自動更新，使用者需要重新整理頁面才能看到新通知

**期望行為：**
- 定期 polling（例如每 30 秒）檢查新通知
- 或使用 Supabase Realtime 訂閱

**相關檔案：**
- `src/components/notification/NotificationBell.tsx`

---

## 實作順序建議

### 第一階段：Admin 基礎設施（PA 系列必須最先做）

| 順序 | 任務 | 理由 |
|------|------|------|
| 1 | PA-1 | 建立 admin_users 資料表，所有後續 admin 功能的基礎 |
| 2 | PA-2 | 建立 isAdmin 共用函式，後續 API 都需要引用 |
| 3 | PA-3 | Board archive 改為 admin-only（修改現有 API） |
| 4 | PA-4 | Board unarchive 功能（新增 API + UI） |
| 5 | PA-5 | Post 作者自刪 API（新增 DELETE handler） |
| 6 | PA-6 | Post archive 功能 — admin/mod 可操作 |
| 7 | PA-7 | 修正 moderator 權限 dead code（manage_posts / manage_settings） |

### 第二階段：快速修正（替換 / 接線）

| 順序 | 任務 | 理由 |
|------|------|------|
| 8 | P3-1 | 最快完成，移除壞掉的連結 |
| 9 | P1-11 | 一行替換，將假按鈕換成真元件 |
| 10 | P1-19 | 一行替換，整合已存在的 ThemeToggle |
| 11 | P2-5 | 簡單資料傳遞，修正 karma 顯示 |
| 12 | P1-1, P1-2 | Save/Hide 功能，API 已存在 |
| 13 | P1-4 | Comments 按鈕加上導航 |
| 14 | P1-6, P1-17 | 投票功能修正（參考現有實作） |
| 15 | P1-14 | Link post 修正（綁定 state） |

### 第三階段：中型功能

| 順序 | 任務 | 理由 |
|------|------|------|
| 16 | P1-3, P1-5 | More 選單（需要建立下拉元件，與 PA-5/PA-6 整合） |
| 17 | P0-1, P0-2 | 通知頁面接上後端（API 已存在） |
| 18 | P2-1 | Feed 分頁 / 無限滾動 |
| 19 | P2-2 | Board 排序修正 |
| 20 | P2-3 | userVote 預載 |
| 21 | P2-6 | 手機版搜尋修正 |

### 第四階段：補完與新功能

| 順序 | 任務 | 理由 |
|------|------|------|
| 22 | P2-4 | RightSidebar 真實資料 |
| 23 | P2-7 | 側邊欄數字修正 |
| 24 | P1-9, P1-10 | 個人頁面 Comments/Hidden 分頁 |
| 25 | P1-12 | 標籤選擇器 |
| 26 | P1-15 | Poll duration |
| 27 | P1-16 | 搜尋結果 Join 按鈕 |
| 28 | P1-18 | Forgot Password 流程 |
| 29 | P1-7, P1-8 | Follow 功能（需新建資料表和 API） |
| 30 | P1-13 | 草稿功能（需決定方案） |
| 31 | P2-8 | Tag 頁面改善 |
| 32 | P3-2 | About 頁面 |
| 33 | P3-3 | 權限檢查修正 |
| 34 | P3-4 | 搜尋 People 連結 |
| 35 | P3-5 | 通知即時更新 |
