# Session Notes: Phase 3 Completion (Medium Features)

**日期：** 2026-02-11  
**任務：** 完成第三階段中型功能任務

---

## 📋 工作摘要

完成了第三階段的所有中型功能，包括 More 選單系統、通知整合、Feed 無限滾動、Board 排序和投票狀態預載。

## ✅ 已完成的任務（6 個）

### P1-3: PostActions More 選單 ✅

**實作內容：**
- 下拉選單系統（固定定位 overlay + 選單卡片）
- **Edit**：導向 `/posts/[id]/edit`（重用 CreatePost UI）
- **Delete**：作者可刪除（軟刪除，顯示 [deleted] + 標題）
- **Remove**：版主可移除（顯示移除原因和執行者）
- 權限判斷：`isAuthor` = `authorId === userId`
- 傳入 props：`authorId`, `userId`, `canModerate`

**修改檔案：**
- `src/components/post/PostActions.tsx`
- `src/components/post/PostRow.tsx`

### P1-5: CommentItem More 選單 ✅

**實作內容：**
- 行內編輯（textarea + Save/Cancel 按鈕）
- **Edit**：行內編輯留言內容
- **Delete**：作者可刪除
- **Remove**：版主可移除
- 權限判斷：`isAuthor` = `comment.author_id === userId`
- 新增 props：`canModerate`, `onUpdate`, `onDelete`

**修改檔案：**
- `src/components/comment/CommentItem.tsx`

### P0-1: 通知頁面接上後端 ✅

**實作內容：**
- 移除所有假資料（INITIAL_NOTIFICATIONS）
- 使用 `/api/notifications` GET 取得通知
- **Mark as read**：單個/全部標記已讀
- 顯示未讀數量
- 顯示通知類型圖示（reply, upvote, mention）
- Loading 狀態和空狀態

**修改檔案：**
- `src/app/notifications/page.tsx`（完全重寫）

**API 使用：**
- GET `/api/notifications`
- PATCH `/api/notifications` (body: `{ ids: [...] }`)

### P2-1: Feed 無限滾動 ✅

**實作內容：**
- Intersection Observer 自動觸發載入
- 分頁參數：page, sort, timeRange, boardSlug
- Loading spinner
- 「You've reached the end」提示
- 支援首頁和 Board 頁面

**修改檔案：**
- `src/components/feed/FeedContainer.tsx`

**新增 props：**
- `boardSlug?: string`
- `sortBy?: string`
- `timeRange?: string`

### P2-2: Board 排序修正 ✅

**實作內容：**
- 讀取 URL 參數：`sort` 和 `t`（timeRange）
- 使用 `sortPosts()` 函式進行排序（hot/new/top/rising）
- 套用時間範圍過濾（top/rising 模式）
- 傳入 `sortBy` 和 `timeRange` 到 FeedContainer

**修改檔案：**
- `src/app/r/[slug]/page.tsx`

**使用函式：**
- `sortPosts()` from `@/lib/ranking`
- `getTimeRangeDate()` from `@/lib/ranking`

### P2-3: userVote 預載 ✅

**實作內容：**
- Server 端：查詢 `votes` 表取得使用者投票
- 建立 `userVotes` map：`{ [postId]: 1 | -1 }`
- 將 `userVote` 加入每個 post 物件
- 同時修改：Board 頁面（SSR）和 API route（首頁）

**修改檔案：**
- `src/app/r/[slug]/page.tsx`（SSR userVote 預載）
- `src/app/api/posts/route.ts`（API 返回 userVote）
- `src/app/page.tsx`（使用 API 的 userVote）

**查詢邏輯：**
```typescript
const { data: votes } = await supabase
  .from('votes')
  .select('post_id, value')
  .eq('user_id', user.id)
  .in('post_id', postIds);
```

---

## 🔍 技術細節

### More 選單架構

```typescript
// 選單結構
{showMoreMenu && (
  <>
    {/* 半透明遮罩關閉選單 */}
    <div className="fixed inset-0 z-10" onClick={close} />
    
    {/* 選單卡片 */}
    <div className="absolute ... z-20">
      {isAuthor && <Edit /> && <Delete />}
      {canModerate && !isAuthor && <Remove />}
    </div>
  </>
)}
```

### 無限滾動實作

```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading) {
        loadMore();
      }
    },
    { threshold: 0.1 }
  );

  if (loadMoreRef.current) {
    observer.observe(loadMoreRef.current);
  }

  return () => observer.disconnect();
}, [hasMore, isLoading, page]);
```

### Board 排序流程

1. 從 URL 讀取 `sort` 和 `t` 參數
2. 查詢所有貼文（limit 100）
3. 套用時間範圍過濾（如果需要）
4. 使用 `sortPosts()` 排序
5. 取前 20 筆顯示

### userVote 預載策略

- **SSR（Board 頁面）**：在 server component 中查詢並傳入
- **CSR（首頁）**：在 API route 中查詢並返回
- **效能優化**：使用 `IN` 查詢批次取得多個 post 的投票狀態

---

## 📊 進度統計

- **完成任務數：** 6 個（+ 1 取消）
- **總進度：** 21/35 (60%)
- **本次修改檔案：** 9 個
- **總耗時：** 約 90 分鐘

---

## 📝 文檔更新

已更新 `plans/webapp/incomplete-features.md`：
- 新增第三階段完成任務列表
- 更新進度統計：21/35 已完成
- 標記 P0-2 為已取消
- 調整待處理任務數量：13/35

---

## 💡 經驗總結

### 技術亮點

1. **More 選單模式統一**
   - Post 和 Comment 使用相同的 UI 模式
   - 固定定位 overlay + absolute 選單卡片
   - 權限邏輯清晰（isAuthor vs canModerate）

2. **無限滾動效能優化**
   - Intersection Observer 比 scroll event 更高效
   - threshold: 0.1 提前觸發載入
   - 自動清理 observer（useEffect cleanup）

3. **排序算法整合**
   - 重用 `src/lib/ranking.ts` 的函式
   - Hot/Rising/Top/New 統一處理
   - 時間範圍過濾靈活

4. **userVote 預載**
   - 批次查詢減少 DB 請求
   - SSR 和 CSR 雙重支援
   - Map 結構快速查找 O(1)

### 遇到的挑戰

1. **More 選單權限判斷**
   - 解決：傳入 `authorId` 和 `userId`，在元件內比較
   - 避免：父元件計算 boolean 增加複雜度

2. **通知頁面資料結構**
   - 解決：完全重寫頁面，使用真實 API 資料結構
   - 移除：所有假資料和 mock 邏輯

3. **Board 排序 + userVote 同時實作**
   - 解決：先實作排序，再加入 userVote 查詢
   - 注意：userVote 查詢要在排序後的前 20 筆

---

## 🚀 下一步建議

目前還有 13 個待處理任務，主要分布在：

### P1 系列（按鈕/表單功能）
- P1-7/P1-8: Follow 功能（需新建資料表和 API）
- P1-9/P1-10: 個人頁面 Comments/Hidden 分頁
- P1-12: CreatePostForm 標籤選擇器
- P1-13: Save Draft 功能
- P1-14: Link post URL 綁定
- P1-15: Poll duration
- P1-16: 搜尋結果 Join 按鈕
- P1-18: Forgot Password

### P2 系列（功能不完整）
- P2-4: RightSidebar Recent Posts
- P2-6: MobileSearchOverlay
- P2-7: Post Detail 側邊欄數字
- P2-8: Tag 頁面改善

### P3 系列（壞連結）
- P3-2: /about 頁面
- P3-3: BoardLayout 權限檢查
- P3-4: 搜尋 People 連結
- P3-5: NotificationBell 即時更新

**建議優先順序：**
1. P1 系列的簡單修正（P1-14, P1-16, P1-18）
2. P3 系列的快速修正（P3-2, P3-3, P3-4）
3. P2 系列的 UI 改善（P2-6, P2-7, P2-8）
4. P1 系列的大型功能（P1-7/P1-8 Follow, P1-13 Draft）

預估完成所有剩餘任務需要 4-6 小時。

---

## 👤 使用者反饋記錄

**Q:** Post More 選單功能範圍？  
**A:** Delete + Edit (reuse create UI) + Remove (admin & owner, show reason)

**Q:** Edit 實作方式？  
**A:** 導向 /posts/[id]/edit，重用 CreatePost UI，支援 draft

**Q:** 通知封存功能？  
**A:** 不需要 archive

**結論：** 根據使用者需求調整實作範圍，避免過度設計。
