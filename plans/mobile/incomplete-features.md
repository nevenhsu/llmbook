# Mobile (RWD) 未完成功能清單

> **目的：** 列出所有 mobile 響應式相關的未完成項目。與 `plans/webapp/incomplete-features.md` 搭配使用。
>
> **規則：** 本文檔不含任何程式碼。
>
> **注意：** 以下許多問題的根本原因是 webapp 功能本身未完成（參見 webapp 文檔）。修正 webapp 功能時應同時確保 mobile 適配。

---

## 📊 實作進度

**最後更新：** 2026-02-12

### ✅ 全部完成 (6/6)

所有 mobile 響應式功能已完成！

---

## M-1: MobileSearchOverlay 搜尋完全不能用 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 整合 SearchBar 的搜尋邏輯（debounce 300ms）
- ✅ 呼叫 `/api/search` 取得即時搜尋結果
- ✅ 顯示最多 5 筆貼文結果
- ✅ 點擊結果導向 `/r/[slug]/posts/[id]` 並關閉 overlay
- ✅ 按 Enter 或點擊 "Search for..." 跳轉到 `/search?q=...`
- ✅ 顯示 board 名稱（r/slug）在結果下方

**相關檔案：**
- `src/components/search/MobileSearchOverlay.tsx` (已更新)

---

## M-2: MobileBottomNav 的 /popular 連結 404 ✅

**狀態：** 已完成（先前在 webapp P3-1 中完成）

**實作內容：**
- ✅ 已移除所有 `/popular` 連結
- ✅ 底部導航列已不存在或已移除 Popular 按鈕

---

## M-3: BoardLayout 手機版管理選單沒有權限檢查 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ 新增 `canManage` prop 到 `BoardLayout`
- ✅ 只有 moderator/owner 才能看到三點選單按鈕
- ✅ Board 頁面查詢使用者的 moderator 狀態並傳遞給 `BoardLayout`
- ✅ 非管理者完全看不到管理選單入口

**相關檔案：**
- `src/components/board/BoardLayout.tsx` (新增 canManage prop)
- `src/app/r/[slug]/page.tsx` (查詢權限並傳遞)

---

## M-4: 通知頁面的 Mock 資料（影響所有尺寸） ✅

**狀態：** 已完成（先前在 webapp P0-1 中完成）

**實作內容：**
- ✅ 通知頁面已接上真實的 `/api/notifications` API
- ✅ 手機和桌面版都顯示真實資料

---

## M-5: Feed 無限滾動在手機上的體驗 ✅

**狀態：** 已完成（先前在 webapp P2-1 中完成）

**實作內容：**
- ✅ Feed 無限滾動已實作並在手機上正常運作
- ✅ 使用 IntersectionObserver 觸發載入
- ✅ 手機和桌面版使用相同的邏輯

---

## M-6: PostActions 選單在手機上的互動 ✅

**狀態：** 已完成（2026-02-12）

**實作內容：**
- ✅ Save/Hide 按鈕功能已在 webapp P1-1, P1-2 完成
- ✅ More 選單改用 DaisyUI `modal-bottom sm:modal-middle`
- ✅ 手機上從底部彈出，桌面版居中顯示
- ✅ 觸控區域增大（px-4 py-3），適合手機操作
- ✅ 使用原生 `<dialog>` 元素，支援 ESC 和背景點擊關閉
- ✅ 按鈕 icon 放大到 20px，文字使用 text-base

**相關檔案：**
- `src/components/post/PostActions.tsx` (重構 More 選單)

---

## 實作摘要

所有 mobile 響應式功能已於 2026-02-12 完成：

1. **M-1**: MobileSearchOverlay 搜尋功能 - 與 desktop 共用邏輯
2. **M-2**: 移除 /popular 連結 - 已在 webapp 完成
3. **M-3**: BoardLayout 管理選單權限檢查 - 只有 moderator/owner 可見
4. **M-4**: 通知頁面真實資料 - 已在 webapp 完成
5. **M-5**: Feed 無限滾動 - 已在 webapp 完成
6. **M-6**: PostActions More 選單 - 使用 modal-bottom，觸控友善

## 實作注意事項

1. **大部分問題的根因在 webapp 層**：修正 webapp 文檔中的任務時，應同時測試手機版
2. **測試寬度**：所有修正應在 375px（iPhone SE）寬度下測試
3. **觸控優先**：手機上的互動元件（下拉選單、modal）優先考慮觸控友善的 DaisyUI 元件（modal-bottom、dropdown）
4. **效能**：手機上的 infinite scroll、搜尋 debounce 要注意效能
