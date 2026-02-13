# Post Row UI 修復

**狀態**: Pending  
**優先級**: Medium  
**日期**: 2026-02-13

## 問題描述

Post row 組件存在多個 UI/UX 問題需要修復。

---

## Bug 列表

### 1. Post Action 不應跳轉到文章內頁

**現況**: 點擊 post action 時會跳轉到文章詳細頁面  
**期望**: 點擊 post action 時應停留在當前頁面，只執行對應的操作

**影響範圍**:
- `/` (首頁)
- `/b/[slug]` (看板頁面)
- 其他顯示 post list 的頁面

**修復方向**:
- 檢查 post row 點擊事件的 event propagation
- 確保 action button 的 onClick 有 `e.stopPropagation()`

---

### 2. Post Action 統一使用 Dropdown

**現況**: 部分 post action 使用 modal 彈窗  
**期望**: 所有 post action 都應使用 dropdown 選單

**受影響的 Actions**:
- Edit (編輯)
- Delete (刪除)
- 其他 post 操作

**修復方向**:
- 移除 modal-based post actions
- 統一使用 dropdown menu component
- 參考現有的 dropdown 實作模式

---

### 3. 首頁 Post Author More Button 缺少選項

**現況**: 在首頁 (`/`)，當用戶是文章作者時，點擊 more button 沒有看到 delete/edit 選項  
**期望**: Post author 應該能看到並使用 delete/edit 選項

**位置**: `/` (首頁)

**調查方向**:
- 檢查首頁的 post row component 實作
- 確認 dropdown menu items 的條件渲染邏輯
- 對比看板頁面 (`/b/[slug]`) 的實作差異

**可能原因**:
- 首頁使用的 post row component 版本不同
- 權限檢查邏輯錯誤
- User context 傳遞問題

---

### 4. 非作者隱藏 More Button

**現況**: More button 對所有用戶顯示  
**期望**: 若當前用戶不是 post author，應完全隱藏 more button (delete/edit)

**權限邏輯**:
```typescript
// 顯示 more button 的條件
const showMoreButton = currentUser && currentUser.id === post.author_id;
```

**修復方向**:
- 在 post row component 中加入條件渲染
- 考慮 board moderator/admin 的額外權限
- 確保在未登入狀態下也正確隱藏

---

## 相關檔案

需要檢查的檔案:
- `app/components/posts/PostRow.tsx` (或類似的 post row component)
- `app/(home)/page.tsx` (首頁實作)
- `app/b/[slug]/page.tsx` (看板頁面實作)
- 其他包含 post list 的頁面

---

## 實作建議

### 優先順序
1. **P0**: Bug #4 - 非作者隱藏 more button (安全性問題)
2. **P1**: Bug #3 - 首頁缺少 delete/edit 選項 (功能缺失)
3. **P1**: Bug #1 - 點擊不跳轉 (UX 問題)
4. **P2**: Bug #2 - 統一使用 dropdown (一致性優化)

### 測試檢查項目
- [ ] 首頁 post row 顯示正確的 actions
- [ ] 看板頁面 post row 顯示正確的 actions
- [ ] 非作者看不到 more button
- [ ] Post author 可以看到並使用 edit/delete
- [ ] 點擊 action 不會跳轉到文章內頁
- [ ] 所有 post actions 都使用 dropdown (無 modal)
- [ ] Board moderator/admin 權限正確運作

---

## 備註

- 需要確認是否有統一的 PostRow component，或是不同頁面使用不同版本
- 考慮建立統一的 post actions logic 以避免重複 bugs
- 權限檢查應該在 component level 和 API level 都進行
