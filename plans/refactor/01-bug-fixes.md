# P0 — Bug 修正

> **優先順序：P0 — 立即執行**  
> 這些是功能損壞的 Bug，會直接影響使用者體驗，必須最先處理。

---

## Bug 1：通知連結路徑錯誤

### 問題描述

`src/types/notification.ts` 中的 `getNotificationLink()` 函式生成的路徑指向不存在的路由。

### 受影響檔案

- `src/types/notification.ts`

### 現況（有問題的代碼）

```typescript
// src/types/notification.ts (約第 148-160 行)

case "post_vote":
case "post_comment":
case "comment_reply":
  return `/posts/${p.postId}`;            // ❌ 路由不存在

case "new_follower":
  return `/profile/${p.followerUsername}`; // ❌ 路由不存在
```

### 期望修正後

```typescript
case "post_vote":
case "post_comment":
case "comment_reply":
  // 需要 boardSlug 才能構成正確路徑
  return `/r/${p.boardSlug}/posts/${p.postId}`; // ✅ 正確路由

case "new_follower":
  return `/u/${p.followerUsername}`;            // ✅ 正確路由
```

### 修正步驟

1. 打開 `src/types/notification.ts`，找到 `getNotificationLink()` 函式。
2. 確認 `Notification` 型別或 payload 物件上是否有 `boardSlug` 欄位。
   - 如果有：直接替換路徑字串。
   - 如果沒有：
     a. 查看 `src/app/api/notifications/route.ts`，確認通知資料查詢時有 join `boards.slug`。
     b. 若沒有 join，需在查詢中加入 `posts(boards(slug))` 以取得 `boardSlug`。
     c. 更新 `Notification` 型別定義，新增 `boardSlug?: string` 欄位。
3. 更新 `getNotificationLink()` 函式使用正確路徑。
4. 所有 `/profile/` 路徑替換為 `/u/`。
5. 驗證：在瀏覽器中觸發通知，點擊連結確認能正確導航。

### 注意事項

- 通知可能包含已刪除帖子的情況，需保留 null 安全處理：`boardSlug ? \`/r/${boardSlug}/posts/${postId}\` : null`

---

## Bug 2：`CommentItem` 使用瀏覽器 `prompt()` 對話框

### 問題描述

當版主在 `CommentItem` 中點擊「Remove Comment」時，會呼叫原生瀏覽器 `prompt()` 對話框，這是已知的反模式：

- 行動裝置上外觀不可客製化
- 有些瀏覽器 (Safari PWA 模式) 會完全封鎖 `prompt()`
- 與專案設計系統不一致

### 受影響檔案

- `src/components/comment/CommentItem.tsx`（約第 104 行）

### 現況

```typescript
// src/components/comment/CommentItem.tsx:104
const handleModeratorRemove = async () => {
  const reason = prompt("Reason for removal (optional):"); // ❌ 原生對話框
  if (reason === null) return; // 使用者取消
  await removeComment(comment.id, reason);
};
```

### 期望修正後

使用專案現有的 `ConfirmModal` 元件（`src/components/ui/ConfirmModal.tsx`）改為 React 狀態控制的 Modal：

```typescript
// 新增狀態
const [removeModalOpen, setRemoveModalOpen] = useState(false);
const [removeReason, setRemoveReason] = useState("");

// 觸發函式
const handleModeratorRemove = () => {
  setRemoveModalOpen(true);
};

// 確認函式
const handleConfirmRemove = async () => {
  await removeComment(comment.id, removeReason);
  setRemoveModalOpen(false);
  setRemoveReason("");
};

// JSX 中加入 Modal
<ConfirmModal
  open={removeModalOpen}
  title="Remove Comment"
  description="Please provide an optional reason for removal:"
  onConfirm={handleConfirmRemove}
  onCancel={() => { setRemoveModalOpen(false); setRemoveReason(""); }}
>
  <textarea
    value={removeReason}
    onChange={(e) => setRemoveReason(e.target.value)}
    placeholder="Reason (optional)"
    className="textarea textarea-bordered w-full mt-2"
    rows={3}
  />
</ConfirmModal>
```

### 修正步驟

1. 打開 `src/components/comment/CommentItem.tsx`。
2. 確認 `ConfirmModal` 元件的 props 介面（閱讀 `src/components/ui/ConfirmModal.tsx`）。
3. 在 `CommentItem` 中加入 `removeModalOpen` 和 `removeReason` 兩個 state。
4. 替換 `prompt()` 呼叫為 `setRemoveModalOpen(true)`。
5. 在 JSX 底部加入 `ConfirmModal`，包含 `<textarea>` 讓版主輸入理由。
6. 測試：以版主身份登入，嘗試刪除評論，確認 Modal 正常出現和提交。

---

## Bug 3：`hover:hover:` CSS 重複前綴（18 處）

### 問題描述

TailwindCSS 的 `hover:` variant 被重複寫成 `hover:hover:`，導致 hover 樣式完全無效。

### 受影響檔案及位置

| 檔案                                                       | 行號（約）     | 錯誤 class         |
| ---------------------------------------------------------- | -------------- | ------------------ |
| `src/components/ui/VotePill.tsx`                           | 44, 60, 80, 96 | `hover:hover:bg-*` |
| `src/components/tiptap-templates/simple/simple-editor.tsx` | 多處           | `hover:hover:bg-*` |
| `src/components/layout/UserMenu.tsx`                       | 多處           | `hover:hover:bg-*` |
| `src/components/layout/Header.tsx`                         | 多處           | `hover:hover:bg-*` |
| `src/components/search/SearchBar.tsx`                      | 多處           | `hover:hover:bg-*` |

### 修正方法

全局搜尋 `hover:hover:` 並替換為 `hover:`：

```bash
# 搜尋所有受影響行
grep -rn "hover:hover:" src/
```

對每個找到的行，把 `hover:hover:` 替換為 `hover:`。

**範例：**

```
// Before
className="... hover:hover:bg-base-300 ..."

// After
className="... hover:bg-base-300 ..."
```

### 修正步驟

1. 執行上面的 grep 命令，確認所有受影響位置。
2. 逐檔案修正每個 `hover:hover:` → `hover:`。
3. 啟動開發伺服器，視覺確認 hover 效果已生效（按鈕、選單項目等）。

---

## 驗收標準

- [ ] 所有通知連結點擊後能正確導航至對應頁面。
- [ ] 版主移除評論時出現自定義 Modal，而非瀏覽器原生對話框。
- [ ] 所有 hover 效果正常顯示（不再是雙重 `hover:hover:`）。
- [ ] `pnpm test` 全部通過。
