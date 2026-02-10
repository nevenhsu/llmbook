# Mobile (RWD) 未完成功能清單

> **目的：** 列出所有 mobile 響應式相關的未完成項目。與 `plans/webapp/incomplete-features.md` 搭配使用。
>
> **規則：** 本文檔不含任何程式碼。
>
> **注意：** 以下許多問題的根本原因是 webapp 功能本身未完成（參見 webapp 文檔）。修正 webapp 功能時應同時確保 mobile 適配。

---

## M-1: MobileSearchOverlay 搜尋完全不能用

**現狀：**
- 手機版點擊搜尋按鈕打開 overlay，有 input
- 輸入任何文字永遠顯示「No results」
- 原始碼有註解暗示未完成：`"Results area — wired in webapp Phase 5"`
- Desktop 版 `SearchBar` 的即時搜尋功能已經完成

**期望行為：**
- 與 desktop 版相同的即時搜尋功能（debounce 300ms、呼叫 `/api/search`、顯示結果）
- 點擊結果導向對應頁面並關閉 overlay
- 支援按 Enter 跳轉到完整搜尋頁面

**相關檔案：**
- `src/components/search/MobileSearchOverlay.tsx`
- `src/components/search/SearchBar.tsx`（desktop 版，可參考邏輯）

**對應 webapp 任務：** P2-6

---

## M-2: MobileBottomNav 的 /popular 連結 404

**現狀：**
- 手機底部導航列有 Popular 圖示，連結到 `/popular`
- 該頁面不存在

**期望行為：**
- 移除 Popular 連結（首頁已有 Hot 排序功能）
- 或替換成其他有用的連結

**相關檔案：**
- `src/components/layout/MobileBottomNav.tsx`

**對應 webapp 任務：** P3-1

---

## M-3: BoardLayout 手機版管理選單沒有權限檢查

**現狀：**
- 手機版 Board 頁面的三點選單，「Members & Bans」和「Board Settings」連結對所有使用者可見
- 目標頁面有權限檢查，但不應讓非管理者看到這些入口

**期望行為：**
- 只有 owner/moderator 才能看到管理連結
- 需要將使用者角色資訊傳入 `BoardLayout`

**相關檔案：**
- `src/components/board/BoardLayout.tsx`

**對應 webapp 任務：** P3-3

---

## M-4: 通知頁面的 Mock 資料（影響所有尺寸）

**現狀：**
- 通知頁面在手機上顯示的也是假資料
- 與 desktop 是同一個問題

**對應 webapp 任務：** P0-1, P0-2

---

## M-5: Feed 無限滾動在手機上的體驗

**現狀：**
- 手機上只能看到初始載入的貼文，無法載入更多
- 與 desktop 是同一個問題，但在手機上更明顯（螢幕小，看到的貼文更少）

**期望行為：**
- Infinite scroll 在手機上要流暢
- 「Load more」的 trigger 點要考慮手機的 viewport

**對應 webapp 任務：** P2-1

---

## M-6: PostActions 選單在手機上的互動

**現狀：**
- PostActions 的 Save/Hide/More 按鈕在手機上也都沒有功能
- 手機上的 More 選單應該用 bottom sheet 而不是 dropdown

**期望行為：**
- 修正 webapp 功能的同時，手機版的互動方式應適合觸控：
  - 「More」選單使用 bottom sheet 或 DaisyUI modal-bottom
  - 按鈕觸控區域至少 44x44px
  - 有 haptic 或 visual feedback

**對應 webapp 任務：** P1-1, P1-2, P1-3

---

## 實作注意事項

1. **大部分問題的根因在 webapp 層**：修正 webapp 文檔中的任務時，應同時測試手機版
2. **測試寬度**：所有修正應在 375px（iPhone SE）寬度下測試
3. **觸控優先**：手機上的互動元件（下拉選單、modal）優先考慮觸控友善的 DaisyUI 元件（modal-bottom、dropdown）
4. **效能**：手機上的 infinite scroll、搜尋 debounce 要注意效能
