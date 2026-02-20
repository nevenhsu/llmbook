# P1 — 剩餘 raw fetch 統一

> 延續 Round 1 P1a，把剩餘 component 的 raw `fetch` 換成 `apiPost/apiDelete/apiPatch/apiFetchJson`。

## 背景

Round 1 已處理：PostActions, BoardSettingsForm (PATCH/DELETE), BanActions, BoardInfoCard,
profile-form, UnarchiveButton, CreateBoardForm, PollDisplay, CommentItem。

剩餘 21 處分布在：

| 檔案                        | 方法        | 端點                                                  |
| --------------------------- | ----------- | ----------------------------------------------------- |
| `BoardMemberManagement.tsx` | DELETE      | `/api/boards/${slug}/members/${userId}`               |
| `BoardMemberManagement.tsx` | POST        | `/api/boards/${slug}/bans`                            |
| `BoardMemberManagement.tsx` | DELETE      | `/api/boards/${slug}/bans/${userId}`                  |
| `BoardLayout.tsx`           | PATCH       | `/api/boards/${slug}`                                 |
| `BoardSettingsForm.tsx`     | GET         | `/api/search?type=people&q=...`                       |
| `JoinButton.tsx`            | POST/DELETE | `/api/boards/${slug}/join`                            |
| `NotificationList.tsx`      | GET         | `/api/notifications?...`                              |
| `NotificationList.tsx`      | PATCH       | `/api/notifications` (mark all read)                  |
| `NotificationList.tsx`      | PATCH       | `/api/notifications/${id}`                            |
| `NotificationBell.tsx`      | GET         | `/api/notifications?limit=5`                          |
| `CommentThread.tsx`         | GET         | `/api/posts/${postId}/comments?sort=...`              |
| `CommentForm.tsx`           | POST        | `/api/posts/${postId}/comments`                       |
| `CommentEditorModal.tsx`    | PATCH       | `/api/comments/${commentId}`                          |
| `CommentEditorModal.tsx`    | POST        | `/api/posts/${postId}/comments`                       |
| `follow/FollowButton.tsx`   | POST/DELETE | `/api/follows`                                        |
| `profile/FollowButton.tsx`  | POST/DELETE | `/api/users/${userId}/follow`                         |
| `SearchBar.tsx`             | GET         | `/api/search?q=...&type=posts`                        |
| `MobileSearchOverlay.tsx`   | GET         | `/api/search?q=...&type=posts`                        |
| `boards/BoardSelector.tsx`  | GET         | `/api/boards/...`                                     |
| `SafeHtml.tsx`              | POST        | `/api/mentions/resolve`                               |
| `PollDisplay.tsx`           | POST        | `/api/polls/${postId}/vote` (特殊 401/403 處理，保留) |

## 分類處理

**直接換（無特殊邏輯）：**

- POST/DELETE/PATCH → `apiPost`, `apiDelete`, `apiPatch`
- GET with response → `apiFetchJson`

**保留 raw fetch 的例外：**

- `PollDisplay.tsx` vote：需要手動處理 401/403 狀態碼（Round 1 已決定保留）
- `CommentThread.tsx` GET comments：使用 `apiFetchJson` 即可，但需要保留現有 error handling

**搜尋 GET 的處理：**
`BoardSettingsForm` 和 `SearchBar`/`MobileSearchOverlay` 是帶 query string 的 GET，
用 `apiFetchJson` 處理（已在 Round 1 加入）。

## 執行順序

1. `NotificationList` + `NotificationBell`（同一個 notification domain）
2. `CommentThread` + `CommentForm` + `CommentEditorModal`（同一個 comment domain）
3. `follow/FollowButton` + `profile/FollowButton`（可能可以合併成一個）
4. `BoardMemberManagement` + `BoardLayout` + `JoinButton`（board domain）
5. `SearchBar` + `MobileSearchOverlay`（搜尋，可抽共用 fetch 邏輯）
6. `BoardSelector` + `SafeHtml`（雜項）

## 驗收標準

- [ ] `grep -rn "await fetch" src/components/` 只剩 PollDisplay 的 vote
- [ ] `pnpm build` 零錯誤
