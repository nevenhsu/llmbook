# Session Notes: Quick Fixes (Phase 2)

**日期：** 2026-02-11  
**任務：** 完成第二階段快速修正任務（簡單的替換/接線）

---

## 📋 工作摘要

完成了 8 個快速修正任務，這些都是簡單的「替換現有元件」或「接上 API」的工作。

## ✅ 已完成的任務

### P3-1: 移除 /popular 連結 ✅
- **問題：** `/popular` 頁面不存在，導致 404
- **解決方案：** 將 MobileBottomNav 的 Popular 連結改為指向 `/?sort=hot`
- **修改檔案：** `src/components/layout/MobileBottomNav.tsx`

### P1-11: BoardInfoCard Join 按鈕接上功能 ✅
- **問題：** Join 按鈕是靜態的，沒有功能
- **解決方案：** 替換為功能完整的 `JoinButton` 元件
- **修改檔案：** `src/components/board/BoardInfoCard.tsx`
- **相關元件：** `src/components/board/JoinButton.tsx`（已存在）

### P1-19: UserMenu Display Mode 按鈕 ✅
- **問題：** Display Mode 按鈕沒有功能
- **發現：** 功能已完整實作！UserMenu 已有主題切換邏輯
- **狀態：** 標記為完成，無需修改

### P2-5: UserMenu Karma 顯示真實數值 ✅
- **問題：** Karma hardcoded 為 "1 karma"
- **解決方案：**
  - UserMenu 加入 `karma` 到 interface
  - 顯示 `{profile?.karma || 0} karma`
  - layout.tsx 查詢中加入 karma 欄位
- **修改檔案：**
  - `src/components/layout/UserMenu.tsx`
  - `src/app/layout.tsx`

### P1-1 & P1-2: PostActions Save/Hide 按鈕接上 API ✅
- **問題：** Save 和 Hide 按鈕的 `onSave` 和 `onHide` 從未被傳入
- **解決方案：**
  - PostRow 加入 save/hide 狀態管理
  - 實作 `handleSave` 和 `handleHide` 函式
  - 呼叫 `/api/saved/{id}` 和 `/api/hidden/{id}`
  - Optimistic update
  - Hidden 的貼文直接從 UI 移除
- **修改檔案：**
  - `src/components/post/PostRow.tsx`
  - `src/components/post/PostActions.tsx`（加入 `isSaved` prop 和視覺回饋）

### P1-4: PostActions Comments 按鈕加上導航 ✅
- **問題：** Comments 按鈕不可點擊
- **解決方案：**
  - Feed 中：導向 `/posts/{id}#comments`
  - Detail 頁中：滾動到留言區
  - 加入 `inDetailPage` prop 判斷行為
- **修改檔案：** `src/components/post/PostActions.tsx`

### P1-6: ProfilePostList 投票功能 ✅
- **問題：** 投票 handler 只有 console.log
- **解決方案：**
  - 實作真正的投票邏輯
  - 呼叫 `/api/votes` POST
  - Optimistic update
  - 狀態管理
- **修改檔案：** `src/components/profile/ProfilePostList.tsx`

### P1-17: 搜尋結果投票功能 ✅
- **問題：** 投票 handler 是空函式 `() => {}`
- **解決方案：**
  - 實作 `handleVote` 函式
  - 呼叫 `/api/votes` POST
  - Optimistic update
- **修改檔案：** `src/app/search/page.tsx`

---

## 🔍 技術細節

### 投票功能實作模式
所有投票功能都遵循相同的模式：

```typescript
const handleVote = async (postId: string, value: 1 | -1) => {
  try {
    const res = await fetch('/api/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, value })
    });

    if (!res.ok) throw new Error('Vote failed');

    const { score } = await res.json();
    
    // Optimistic update
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, score, userVote: value }
        : post
    ));
  } catch (err) {
    console.error('Failed to vote:', err);
  }
};
```

### Save/Hide 功能
- **Save:** POST/DELETE `/api/saved/{id}`，切換 saved 狀態，視覺回饋（filled bookmark icon）
- **Hide:** POST `/api/hidden/{id}`，從 UI 移除貼文（`return null`）

### Comments 導航
- 使用 `useRouter().push()` 導航到貼文詳情頁
- 使用 `scrollIntoView()` 滾動到留言區
- 根據 `inDetailPage` prop 判斷行為

---

## 📊 進度統計

- **完成任務數：** 8 個
- **總進度：** 15/35 (43%)
- **本次修改檔案：** 9 個
- **總耗時：** 約 30 分鐘

---

## 📝 文檔更新

已更新 `plans/webapp/incomplete-features.md`：
- 更新進度統計：15/35 已完成
- 標記第二階段所有任務為完成
- 調整待處理任務數量

---

## 🚀 下一步建議

根據實作順序，接下來應該進入：

### 第三階段：中型功能

優先處理以下任務：

1. **P1-3, P1-5**: More 選單（需要建立下拉元件）
2. **P0-1, P0-2**: 通知頁面接上後端（API 已存在）
3. **P2-1**: Feed 分頁 / 無限滾動
4. **P2-2**: Board 排序修正
5. **P2-3**: userVote 預載

預估時間：每個任務 30-60 分鐘，約 3-5 小時可完成第三階段。

---

## 💡 經驗總結

### 有效的策略
1. **批次處理相似任務**：投票功能、Save/Hide 一起處理，代碼模式一致
2. **複用現有元件**：JoinButton 已存在，直接替換即可
3. **Optimistic update**：所有互動都採用 optimistic update，提升用戶體驗

### 避免的陷阱
- ✅ 確認功能真的不存在再修改（P1-19 其實已完成）
- ✅ 修改 interface 時同步更新所有使用處
- ✅ TypeScript 類型錯誤要立即修正
