# Webapp 未完成功能清單

> **目的：** 列出所有「只有 UI 沒有功能」的模組，供 Codex 逐項實作。
>
> **規則：** 本文檔不含任何程式碼。每個任務描述「現狀」、「期望行為」、「相關檔案」和「相關 API」。
>
> **約定：** 實作時遵守 `plans/webapp/_conventions.md` 與 `AGENTS.md` 的共用函式庫規範。

---

## 📊 實作進度

**最後更新：** 2026-02-12 (Evening Session - Complete!)

### ✅ 已完成 (35/35 實際任務)

**第一階段：Admin 基礎設施**
- **PA-1**: 建立 admin_users 資料表 ✅
- **PA-2**: Admin 權限檢查共用函式 ✅
- **PA-3**: Board Archive 改為 admin-only ✅
- **PA-4**: Board Unarchive 功能 ✅
- **PA-5**: Post 刪除 API（作者自刪）✅
- **PA-6**: Post Archive 功能（admin/moderator）✅
- **PA-7**: 修正 Board Moderator 權限 dead code ✅

**第二階段：快速修正**
- **P3-1**: 移除 /popular 連結 ✅
- **P1-11**: BoardInfoCard Join 按鈕 ✅
- **P1-19**: UserMenu Display Mode ✅
- **P2-5**: UserMenu Karma 顯示 ✅
- **P1-1**: PostActions Save 按鈕 ✅
- **P1-2**: PostActions Hide 按鈕 ✅
- **P1-4**: PostActions Comments 導航 ✅
- **P1-6**: ProfilePostList 投票功能 ✅
- **P1-17**: 搜尋結果投票功能 ✅

**第三階段：中型功能**
- **P1-3**: PostActions More 選單 ✅
- **P1-5**: CommentItem More 選單 ✅
- **P0-1**: 通知頁面接上後端 ✅
- **P2-1**: Feed 無限滾動 ✅
- **P2-2**: Board 排序修正 ✅
- **P2-3**: userVote 預載 ✅

**第四階段：補完與架構優化 (2026-02-12)**
- **P2-4**: RightSidebar Recent Posts 接上真實資料 ✅
- **P2-7**: Post Detail 側邊欄修正（Members 真實數字 + 移除 Online）✅
- **P1-9**: 個人頁面 Comments 分頁功能 ✅
- **架構重構**: 貼文路徑從 /posts/[id] 改為 /r/[slug]/posts/[id]，Board layout 統一管理資料 ✅

**第五階段：補充功能 (2026-02-12)**
- **P3-2**: /about 頁面 ✅
- **P1-18**: Forgot Password 功能 ✅
- **P2-8**: Tag 頁面改善（使用 PostRow 元件）✅

**第六階段：CreatePostForm 功能補完 (2026-02-12)**
- **P1-14**: Link 分頁移除（改用 TipTap 連結功能）✅
- **P1-15**: Poll duration 選擇器送出 ✅
- **P1-12**: Add tags 按鈕功能 ✅
- **P1-13**: 草稿功能 (localStorage) ✅

**第七階段：User Follow 與 Post Edit (2026-02-12 Evening)**
- **P1-7**: Follow 按鈕功能 ✅
- **P1-8**: Followers 數量顯示真實資料 ✅
- **P1-20**: Post Edit 頁面（含 Poll 編輯）✅
- **P3-3**: BoardLayout 管理連結權限檢查（手機版）✅
- **P3-4**: 搜尋頁面 People 結果加上連結 ✅

**第八階段：全域 UserContext 架構優化 (2026-02-12 Evening)**
- **架構優化**: 建立全域 UserContext ✅
  - 建立 `src/contexts/UserContext.tsx`（提供 user, profile, isAdmin）
  - Root layout 統一查詢 isAdmin 並提供給全站
  - 更新 BoardContext 整合 UserContext（useBoardContext 現在自動包含 userId 和 isAdmin）
  - 所有 client component 都可使用 `useUserContext()` 或 `useOptionalUserContext()`
  - Server component 繼續使用 `isAdmin()` 直接查詢
  - 建立使用指南：`docs/contexts/USER_CONTEXT.md`
- **P3-5**: NotificationBell 即時更新 ✅
  - 實作 polling 機制（每 30 秒自動更新）
  - 加入 Page Visibility API（切回頁面時立即更新）
  - 只對已登入使用者顯示和更新

### ⏹️ 已取消 (5 任務)

- **P0-2**: 通知封存頁面（不需要）
- **P1-10**: 個人頁面 Hidden 分頁（用戶要求移除）
- **P1-14**: Link 分頁（改用 TipTap 編輯器的連結功能）✅
- **P1-16**: 搜尋結果中的「Join」按鈕（使用者可直接點擊社群名稱進入）
- **P2-6**: MobileSearchOverlay 搜尋（已在 M-1 完成）

### ⏳ 待處理 (0 任務)

🎉 **所有實際需要的功能都已完成！**

- 總任務數：40
- 已完成：35
- 已取消（不需要）：5
- 完成率：100% (35/35 實際任務)

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

### PA-1: 建立 admin_users 資料表 ✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ Migration 已建立：`supabase/migrations/20260210_admin_users.sql`
- ✅ 資料表：`admin_users` (user_id, role, created_at)
- ✅ RLS 政策：只有 super_admin 可以新增/更新/刪除其他 admin
- ✅ 索引和約束條件完整

**相關檔案：**
- `supabase/migrations/20260210_admin_users.sql`

---

### PA-2: Admin 權限檢查共用函式 ✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ 共用函式已建立：`src/lib/admin.ts`
- ✅ `isAdmin(userId, supabaseClient?)` 函式可查詢 admin_users 表
- ✅ 支援傳入自訂的 supabase client（避免重複建立連線）
- ✅ 回傳 boolean 值

**相關檔案：**
- `src/lib/admin.ts`

---

### PA-3: Board Archive 改為 admin-only ✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ DELETE `/api/boards/[slug]` 已改用 `isAdmin()` 檢查（第 154-157 行）
- ✅ BoardSettingsForm 的 Danger Zone tab 只對 admin 顯示（使用 `isAdmin` prop）
- ✅ Settings 頁面已查詢並傳入 `isAdmin` 狀態
- ✅ Board owner 不再能自行 archive board

**相關檔案：**
- `src/app/api/boards/[slug]/route.ts` (DELETE handler)
- `src/components/board/BoardSettingsForm.tsx` (第 430-438 行)
- `src/app/r/[slug]/settings/page.tsx` (第 37, 66 行)

---

### PA-4: Board Unarchive 功能 ✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ PATCH `/api/boards/[slug]` 支援 `is_archived: false`（第 47-64 行）
- ✅ 只有 admin 可以 unarchive（第 62-64 行）
- ✅ UnarchiveButton 元件已建立：`src/components/board/UnarchiveButton.tsx`
- ✅ `/r/archive` 頁面顯示 Unarchive 按鈕（第 78-84 行）
- ✅ Archived board 頁面橫幅顯示 Unarchive 按鈕（board page 第 131 行）

**相關檔案：**
- `src/app/api/boards/[slug]/route.ts` (PATCH handler)
- `src/components/board/UnarchiveButton.tsx`
- `src/app/r/archive/page.tsx`
- `src/app/r/[slug]/page.tsx`

---

### PA-5: Post 刪除 API（作者自刪）✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ DELETE handler 已建立（第 34-90 行）
- ✅ 只有作者可以刪除（第 58-60 行）
- ✅ 採用軟刪除：設定 `status = 'DELETED'`, `body = '[deleted]'`
- ✅ 清理相關資料：votes, saved_posts, hidden_posts, media, post_tags, poll_options（第 80-87 行）
- ✅ 保留留言脈絡（不刪除 comments）

**相關檔案：**
- `src/app/api/posts/[id]/route.ts` (DELETE handler)

---

### PA-6: Post Archive 功能（admin/moderator）✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ PATCH handler 已建立（第 92-145 行）
- ✅ 支援 `status: 'ARCHIVED'` 和 `status: 'PUBLISHED'`
- ✅ 權限檢查：`isAdmin()` 或 `canManageBoardPosts()`（第 123-128 行）
- ✅ `canManageBoardPosts()` 函式已在 `src/lib/board-permissions.ts` 實作（第 127-148 行）
- ✅ 檢查 moderator 的 `manage_posts` 權限

**相關檔案：**
- `src/app/api/posts/[id]/route.ts` (PATCH handler)
- `src/lib/board-permissions.ts` (canManageBoardPosts)

---

### PA-7: 修正 Board Moderator 權限 dead code ✅

**狀態：** 已完成（2026-02-11）

**實作內容：**
- ✅ `manage_posts` 權限已啟用（在 `canManageBoardPosts` 函式中檢查）
- ✅ `manage_settings` 權限已啟用（PATCH `/api/boards/[slug]` 使用 `canManageBoard` 檢查，第 55-60 行）
- ✅ BoardSettingsForm 權限編輯器的勾選有實際效果
- ✅ Owner 永遠擁有所有權限
- ✅ Moderator 根據個別權限設定進行檢查

**相關檔案：**
- `src/lib/board-permissions.ts` (canManageBoard, canManageBoardPosts)
- `src/app/api/boards/[slug]/route.ts` (PATCH handler)
- `src/components/board/BoardSettingsForm.tsx`

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

### P1-7: 使用者個人頁面「Follow」按鈕沒有功能 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ Migration 已建立：`supabase/migrations/20260212_user_follows.sql`
- ✅ 資料表：`user_follows` (follower_id, following_id, created_at)
- ✅ 約束：no_self_follow CHECK (follower_id != following_id)
- ✅ RLS 政策：任何人可查看，只有 follower 可新增/刪除
- ✅ API 已建立：`/api/users/[userId]/follow` (POST/DELETE)
- ✅ FollowButton 元件：支援 optimistic update
- ✅ 個人頁面整合：顯示 Follow/Following 按鈕
- ✅ 權限檢查：不可 follow 自己、只能 follow 一般使用者（不含 personas）

**相關檔案：**
- `supabase/migrations/20260212_user_follows.sql`
- `src/app/api/users/[userId]/follow/route.ts`
- `src/components/profile/FollowButton.tsx`
- `src/app/u/[username]/page.tsx` (第 60-93 行)

---

### P1-8: 使用者個人頁面「Followers」數量 hardcoded 為 0 ✅

**狀態：** 已完成（2026-02-12，與 P1-7 一起完成）

**實作內容：**
- ✅ 查詢 followers 數量（COUNT user_follows WHERE following_id = userId）
- ✅ 查詢 following 數量（COUNT user_follows WHERE follower_id = userId）
- ✅ 檢查當前使用者是否已 follow 該 profile
- ✅ 側邊欄顯示真實的 Followers 數量

**相關檔案：**
- `src/app/u/[username]/page.tsx` (第 66-93, 296 行)

---

### P1-9: 使用者個人頁面「Comments」分頁沒有資料 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 新增 Comments 分頁查詢邏輯（支援 user 和 persona）
- ✅ 顯示留言內容 + 所屬貼文標題連結（方案 A）
- ✅ 顯示社群資訊（r/board）

**相關檔案：**
- `src/app/u/[username]/page.tsx` (第 70-92 行)
- `src/components/profile/ProfilePostList.tsx` (第 44-82 行)

---

### P1-10: 使用者個人頁面「Hidden」分頁沒有資料 ⏹️

**狀態：** 已取消（2026-02-12）

**原因：** 用戶要求移除 Hidden 分頁功能，不需要實作

**相關檔案：**
- `src/app/u/[username]/page.tsx` (已移除 Hidden 分頁入口)

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

### P1-12: CreatePostForm「Add tags」按鈕沒有功能 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 點擊「Add tags」打開下拉選擇器
- ✅ 顯示所有可用標籤，支援多選
- ✅ 已選標籤顯示為 badge，可點擊 X 移除
- ✅ 標籤資料從 props 傳入（CreatePost 頁面已查詢）
- ✅ 送出貼文時包含 `tagIds` 陣列

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx` (新增標籤選擇器 UI)

---

### P1-13: CreatePostForm「Save Draft」與「Drafts」按鈕沒有功能 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 使用 localStorage 儲存草稿（key: `post-drafts`）
- ✅ 「Save Draft」按鈕儲存當前表單狀態
- ✅ 「Drafts」按鈕打開下拉列表，顯示所有草稿（最多 10 個）
- ✅ 點擊草稿可載入內容
- ✅ 草稿可刪除
- ✅ 草稿包含：title, body, boardId, tagIds, media, pollOptions, pollDuration, activeTab

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx` (新增草稿功能)

---

### P1-14: CreatePostForm「Link」分頁的 URL 輸入未綁定 state ⏹️

**狀態：** 已取消（2026-02-12）

**原因：** 
- TipTap 編輯器已內建連結功能（使用 `@tiptap/extension-link`）
- Link 分頁已從 CreatePostForm 移除
- 使用者可在 Text 和 Media 貼文的 body 中插入連結

**相關檔案：**
- `src/components/tiptap-templates/simple/simple-editor.tsx` (已有連結功能)

---

### P1-15: CreatePostForm Poll 的 duration 選擇器沒有送出 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 前端送出 `pollDuration` 參數（1/3/7 天）
- ✅ 後端計算 `expires_at` 時間戳記（當前時間 + duration 天數）
- ✅ 儲存到 `posts.expires_at` 欄位
- ✅ 建立 migration 新增 `expires_at` 欄位
- ✅ 更新 `schema.sql`

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx` (送出 pollDuration)
- `src/app/api/posts/route.ts` (計算並儲存 expires_at)
- `supabase/migrations/20260212_add_link_text_and_poll_expires.sql` (新建)
- `supabase/schema.sql` (更新)
- 前端 `PollDisplay` 根據 `expires_at` 判斷是否已過期

**相關檔案：**
- `src/components/create-post/CreatePostForm.tsx`
- `src/app/api/posts/route.ts`
- `src/components/post/PollDisplay.tsx`

---

### P1-16: 搜尋結果中的「Join」按鈕沒有功能 ⏹️

**狀態：** 已取消（2026-02-12）

**原因：** 使用者可以直接點擊社群名稱進入社群頁面後再 Join，不需要在搜尋結果頁面提供 Join 按鈕

---

### P1-17: 搜尋結果中的投票沒有功能 ✅

**狀態：** 已完成（先前完成）

---

### P1-18: Login 頁面「Forgot Password」連結指向不存在的頁面 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 建立 `/forgot-password` 頁面（輸入 email，使用 `supabase.auth.resetPasswordForEmail()`）
- ✅ 建立 `/reset-password` 頁面（處理 reset token，使用 `supabase.auth.updateUser()`）
- ✅ 包含完整的錯誤處理和成功提示
- ✅ 自動檢查 session 有效性

**相關檔案：**
- `src/app/login/login-form.tsx`
- `src/app/forgot-password/page.tsx`（新建）
- `src/app/reset-password/page.tsx`（新建）

---

### P1-19: UserMenu「Display Mode」按鈕沒有功能 ✅

**狀態：** 已完成（先前完成）

---

### P1-20: Post Edit 頁面（需建立）✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ **API 擴展**：PATCH `/api/posts/[id]` 支援內容編輯
  - 支援編輯：title, body, tagIds
  - 支援新增 poll options（newPollOptions）
  - 權限檢查：只有作者可以編輯內容
  - 不允許更改：board_id, post_type
- ✅ **PostForm 元件重構**：
  - 重命名：`CreatePostForm` → `PostForm`
  - 新增 `editMode` prop 和 `initialData` prop
  - 編輯模式功能：
    - Board selector 顯示為 disabled（不可更改社群）
    - Tabs 禁用（不可更改貼文類型）
    - Poll 編輯：顯示現有選項（不可編輯/刪除）+ 新增選項輸入框
    - 草稿功能：localStorage key 為 `post-edit-draft-{postId}`
    - 按鈕文字：Update / Updating...
- ✅ **編輯頁面**：`/app/r/[slug]/posts/[id]/edit/page.tsx`
  - 權限檢查：只有作者可編輯（persona 貼文由其他 app 處理）
  - DELETED 狀態處理：顯示標題 + 「已刪除」提示
  - 預載資料：title, body, tags, media, poll options
  - 查詢所有 boards 和 tags 供表單使用

**相關檔案：**
- `src/app/api/posts/[id]/route.ts` (PATCH handler 擴展)
- `src/components/create-post/PostForm.tsx` (重命名並擴展)
- `src/app/r/[slug]/posts/[id]/edit/page.tsx` (新建)
- `src/app/submit/page.tsx` (import 更新)

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

### P2-4: RightSidebar「Recent Posts」完全是假資料 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 從 `/api/posts?sort=new` 獲取真實的最新 5 篇貼文
- ✅ 移除假資料和 "Clear" 按鈕
- ✅ 顯示真實的分數、留言數和時間
- ✅ 貼文連結更新為 `/r/[slug]/posts/[id]`

**相關檔案：**
- `src/components/layout/RightSidebar.tsx` (改為 client component，使用 useEffect fetch 資料)

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

### P2-6: MobileSearchOverlay 搜尋不會呼叫 API ⏹️

**狀態：** 已取消（已在 Mobile M-1 任務中完成，2026-02-12）

**實作內容：**
- ✅ 已在 mobile/incomplete-features.md 的 M-1 任務中完成
- ✅ 整合 SearchBar 的搜尋邏輯（debounce 300ms）
- ✅ 呼叫 `/api/search` 取得即時搜尋結果
- ✅ 顯示最多 5 筆貼文結果

**相關檔案：**
- `src/components/search/MobileSearchOverlay.tsx`

---

### P2-7: Post Detail 頁面側邊欄 member/online 數字是假的 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 貼文路徑重構為 `/r/[slug]/posts/[id]`
- ✅ Board layout 統一管理側邊欄（BoardInfoCard、BoardRulesCard、BoardModeratorsCard）
- ✅ Members 數量使用 `board.member_count` 真實資料
- ✅ 移除 Online 數字（不需要 presence 功能）
- ✅ 移除重複的 board 查詢邏輯

**相關檔案：**
- `src/app/r/[slug]/layout.tsx` (新建，統一查詢 board 資料)
- `src/app/r/[slug]/posts/[id]/page.tsx` (新建，簡化的貼文頁面)
- `src/components/board/BoardInfoCard.tsx` (移除 useMemberCount Context)

---

### P2-8: Tag 頁面的貼文列表太簡陋 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 使用 `PostRow` 元件顯示完整貼文資訊
- ✅ 包含投票功能（含 optimistic update）
- ✅ 顯示作者資訊、board 名稱、留言數、分數、時間戳記
- ✅ 支援 user 和 persona 作者
- ✅ 預載使用者的投票狀態

**相關檔案：**
- `src/app/tags/[slug]/page.tsx`（重構為使用 TagFeed）
- `src/components/tag/TagFeed.tsx`（新建，client component）
- `src/components/post/PostRow.tsx`

---

## P3 — 壞掉的連結與孤立元件

### P3-1: 移除 /popular 連結 ✅

**狀態：** 已完成（先前完成）

---

### P3-2: /about 連結指向不存在的頁面 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 建立 `/about` 頁面（佔位符，包含專案簡介、功能列表、技術棧）
- ✅ DrawerSidebar 的 About 連結現在可正常運作

**相關檔案：**
- `src/components/layout/DrawerSidebar.tsx`
- `src/app/about/page.tsx`（新建）

---

### P3-3: BoardLayout 管理連結沒有權限檢查（手機版）✅

**狀態：** 已完成（先前在 M-3 中完成，2026-02-12 確認）

**實作內容：**
- ✅ BoardLayout 新增 `canManage` prop
- ✅ 只有 moderator/owner 才能看到三點選單按鈕
- ✅ Board 頁面查詢使用者的 moderator 狀態並傳遞
- ✅ 非管理者完全看不到管理選單入口

**相關檔案：**
- `src/components/board/BoardLayout.tsx` (第 23, 37-57 行)
- `src/app/r/[slug]/page.tsx` (第 129-141 行)

---

### P3-4: 搜尋頁面 People 結果沒有連結到個人頁面 ✅

**狀態：** 已完成（先前已完成，2026-02-12 確認）

**實作內容：**
- ✅ Users 結果已用 `<Link>` 包裹，連結到 `/u/${user.username}`
- ✅ Personas 結果也有連結到 `/p/${persona.slug}`
- ✅ 所有 People 搜尋結果都可點擊

**相關檔案：**
- `src/app/search/page.tsx` (第 112-119, 126-133 行)

---

### P3-5: NotificationBell 沒有即時更新 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 實作 polling 機制（每 30 秒自動檢查新通知）
- ✅ 加入 Page Visibility API（當使用者切回頁面時立即更新）
- ✅ 使用 `useOptionalUserContext()` 檢查登入狀態
- ✅ 只對已登入使用者顯示和更新通知
- ✅ 自動清理 interval 和 event listener（避免記憶體洩漏）

**相關檔案：**
- `src/components/notification/NotificationBell.tsx` (已更新)

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
