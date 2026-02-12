# Webapp 各模組測試計畫（不含實作）

> 目的：把「要測什麼、怎麼測、測到什麼程度」寫清楚，交給其他人依文件實作。

## 範圍與原則

### 測試金字塔（建議）

- 單元測試（Unit）：純函式與輕量邏輯（`src/lib/*`, `src/hooks/*`）
- 路由測試（Route / Handler）：Next.js route handlers（`src/app/api/**/route.ts`）用 mock/stub 驗證邏輯與狀態碼
- 整合測試（Integration）：少量「真正打 Supabase」的高價值路徑（已存在 Storage / media upload 範例）

### 目前測試現況（Repo 事實）

- Test runner：Vitest（`package.json#scripts.test`, `vitest.config.ts`）
- Vitest include：僅跑 `src/**/*.test.ts`（不含 `*.spec.*`）
- 預設環境：`node`
- 已有整合測試：
  - `src/lib/supabase/__tests__/storage.test.ts`
  - `src/lib/supabase/__tests__/media-upload.integration.test.ts`（以 `RUN_INTEGRATION=1` gate）

### 分類與命名規範（建議）

- Unit：`*.test.ts`
- Route：`src/app/api/**/__tests__/*.test.ts`（或同層 `*.route.test.ts`）
- Integration：`*.integration.test.ts` 並用 `RUN_INTEGRATION=1` 控制（參考 `src/lib/env.ts#isIntegrationTest`）

## 工具與基礎建設（交付給實作者）

### A. UI / Hook 測試能力（可選，但建議）

現況 Vitest 是 `node` 環境；若要測 React components / hooks：

- 新增 deps（待實作）：`@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- 讓 Vitest 支援 `jsdom`：
  - 方案 1：新增第二份 config（例如 `vitest.ui.config.ts`）
  - 方案 2：在測試檔案層級指定 environment（Vitest 支援 per-file 設定）

### B. API 測試的通用 Mock

Route handlers 常見依賴：

- `cookies()`（`next/headers`）
- `createClient(cookies())`（`@/lib/supabase/server`）

建議建立測試 helper（待實作）：

- `src/test-utils/next-headers.ts`：mock `cookies()`
- `src/test-utils/supabase-mock.ts`：建立可鏈式 `.from().select().eq()...` 的 stub

參考做法：`src/lib/supabase/__tests__/media-upload.integration.test.ts` 會 mock `next/headers` 並手動 seed cookie。

## 模組測試清單（依功能分組）

下面每個模組都包含：核心路徑、必測案例、建議測試層級。

### 1) Auth（註冊 / 登入 / session）

- 檔案：
  - `src/app/api/auth/register/route.ts`
  - `src/app/api/auth/login/route.ts`
  - `src/app/register/register-form.tsx`
  - `src/app/login/login-form.tsx`
  - Docs：`docs/registration-flow.md`, `docs/login-flow.md`
- 必測（Route / Unit）：
  - register：缺欄位 400、username 格式錯 400、username 已存在（狀態碼依現有實作）、建立成功會自動登入/回傳 user
  - login：identifier 為 email / username 都能登入；錯誤訊息一致（避免洩漏 user 是否存在）
  - session cookie：Route 端有設定 cookie（可透過 mock cookieStore 觀察）

### 2) Username（格式 / 可用性）

- 檔案：
  - `src/lib/username-validation.ts`
  - `src/app/api/username/check/route.ts`
  - Doc：`docs/username-validation.md`
- 必測（Unit / Route）：
  - `sanitizeUsername()`：清理規則、長度截斷
  - `validateUsernameFormat()`：所有合法/非法案例（文件已有案例）
  - `/api/username/check`：格式錯誤、已被使用、可用

### 3) Media / Storage（圖片上傳）

- 檔案：
  - `src/app/api/media/upload/route.ts`
  - `src/lib/image-upload.ts`
  - `src/components/ui/ImageUpload.tsx`
  - Docs：`docs/storage-testing.md`, `docs/storage-setup.md`
- 必測：
  - Unit：`validateImageFile()`, `formatBytes()`, `getAspectRatioClass()`
  - Route：缺 file 400、非 image 400、超過 maxBytes 413、成功回傳 `mediaId/url/width/height/sizeBytes`
  - Integration：沿用 `src/lib/supabase/__tests__/media-upload.integration.test.ts`（已存在）

### 4) Posts（列表 / 建立 / 分頁 / 排序）

- 檔案：
  - `src/app/api/posts/route.ts`
  - `src/app/page.tsx`, `src/components/feed/FeedContainer.tsx`, `src/components/feed/FeedSortBar.tsx`
- 必測（Route）：
  - sort：`new/top/hot/rising` 基本輸出有資料時排序合理（可用 stub 資料驗證 query 組裝）
  - filter：`board/tag/author/includeArchived` 行為正確
  - permission：`includeArchived=true` 只有 admin / board 管理者可看（`isAdmin`, `canManageBoard`）
  - pagination：cursor/offset 的語意一致（目前存在不一致風險，見「已知問題」）

### 5) Votes（貼文 / 評論投票）

- 檔案：
  - `src/app/api/votes/route.ts`
  - `src/components/feed/FeedContainer.tsx`
  - `src/components/tag/TagFeed.tsx`
  - `src/components/post/PostDetailVote.tsx`
  - `src/components/profile/ProfilePostList.tsx`
- 必測（Route）：
  - 未登入 401
  - 第一次投票：新增 vote，回傳更新後 score
  - 同值再次投票：toggle off
  - 反向投票：update vote，score 依 DB trigger 更新
  - comment vote 也能走同樣流程

特別注意（應用測試抓出來）：

- Client 端目前存在 payload 不一致：
  - `ProfilePostList` 傳 `{ post_id: ... }`，但 API 讀 `postId`
  - `TagFeed` 可能傳 `value: null`，但 API 只接受 `1 | -1`

建議：先用測試明確定義「唯一正確的 API contract」，再要求所有 client 走同一個 typed helper（見 refactor 文件）。

### 6) Comments（串狀留言 + 通知觸發）

- 檔案：
  - `src/app/api/posts/[id]/comments/route.ts`
  - `src/app/api/comments/[id]/route.ts`
  - `src/components/comment/*`
- 必測（Route）：
  - GET sort：best/new/old/top
  - POST：未登入 401、body 空 400、post 不存在 404、被 ban 403、成功回傳 comment
  - userVotes：登入狀態下有回傳 mapping
  - 通知：reply 會呼叫 `createNotification()`（可用 spy / mock 驗證）

### 7) Notifications（列表 / 標記已讀 / unread count）

- 檔案：
  - `src/app/api/notifications/route.ts`
  - `src/components/notification/NotificationBell.tsx`
  - `src/app/notifications/page.tsx`
  - `src/lib/notifications.ts`
- 必測（Route）：
  - GET：未登入 401；回傳最近 50 筆；排序 created_at desc
  - PATCH：未登入 401；只能更新自己的通知；ids 空/非陣列的輸入處理（依現有實作補測）

### 8) Boards（建立 / 加入退出 / 管理：bans/members/moderators）

- 檔案：
  - `src/app/api/boards/route.ts`
  - `src/app/api/boards/[slug]/**/route.ts`
  - `src/components/board/*`
- 必測（Route）：
  - create board：未登入 401/403（依現有實作）、slug 規則、重複 slug
  - join/leave：member_count 正確更新
  - 管理端（bans/members/moderators）：權限檢查、非法 userId、重複操作 idempotency

### 9) Profile / Settings（個人資料、頭像）

- 檔案：
  - `src/app/api/profile/route.ts`
  - `src/app/settings/profile/profile-form.tsx`
  - `src/app/settings/avatar/avatar-form.tsx`
- 必測（Route）：
  - 未登入 401
  - username 更新：格式、唯一性
  - avatar_url：格式驗證

## 已知問題（先用測試釘住，再 refactor）

- `/api/votes` contract 與 client 呼叫不一致（見 Votes 模組注意事項）
- `/api/posts` pagination 參數語意混雜：`cursor` 同時被當成 offset 與 ISO 日期（見 `src/app/api/posts/route.ts`、`src/components/feed/FeedContainer.tsx`）
- media upload route 使用 `process.env` 讀 bucket（應改用 `privateEnv`）

## Done 定義（給實作者驗收）

- 每個模組至少 1 組 route tests（happy path + auth/error path）
- 針對「已知問題」寫 regression tests，能在 CI 抓到 contract 破壞
- Integration tests 僅保留少量、具高價值且能自動清理（參考 storage/media 測試）
