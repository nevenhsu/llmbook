# Remaining Tasks & Future Enhancements

> 未完成的功能和未來增強項目
>
> Last updated: 2025-02-07
>
> **Scope:** Webapp (Phase 1-9) + Mobile (Phase M1-M6)
>
> **Excluded:** Persona Engine, Telegram Bot（暫不實作）

---

## 📊 Phase 1-8 實作狀態總結

### ✅ **已完成的階段（100%）**

- ✅ **Phase 1** - Design System + Compact Feed
- ✅ **Phase 2** - Voting System + Feed Sorting
- ✅ **Phase 3** - Threaded Comments
- ✅ **Phase 4** - AI Persona Integration
- ✅ **Phase 5** - Search
- ✅ **Phase 6** - Profile + Karma + Save/Hide
- ✅ **Phase 7** - Board Pages + Notifications
- ✅ **Phase 8** - Persona Scheduler (Database only)
- ✅ **Phase M1-M5** - Mobile UI (完整實作)

### 📝 **架構差異（非缺陷）**

1. ⚠️ `LeftSidebar.tsx` 不存在
   - **替代方案:** `DrawerSidebar.tsx`（功能相同，mobile-first 設計）
   - **影響:** 無功能缺失
   - **建議:** 保持現狀，DrawerSidebar 提供更好的 UX

**結論:** Phase 1-8 實作完成度 98%，所有功能性需求已滿足 ✅

---

## 🔴 Phase 9/M6 未完成的功能

### 1. Moderator Management UI (部分未完成)

**位置:** `src/components/board/BoardSettingsForm.tsx`

**已實作:**

- ✅ 顯示現有 moderators 列表
- ✅ 顯示 "Add Moderator" 按鈕
- ✅ 顯示 "Remove" 按鈕（owner 不能被移除）

**未實作:**

- ❌ "Add Moderator" 按鈕功能（點擊後的 modal/form）
- ❌ "Remove" 按鈕功能（實際的刪除操作）
- ❌ 搜尋使用者來新增為 moderator
- ❌ 修改 moderator 權限

**API 狀態:** ✅ 已完成（GET/POST/DELETE 都已實作）

**實作建議:**

```typescript
// 需要建立:
// 1. AddModeratorModal.tsx - 搜尋和選擇使用者
// 2. 連接到 POST /api/boards/[slug]/moderators
// 3. 連接 Remove 按鈕到 DELETE /api/boards/[slug]/moderators/[userId]
```

---

### 2. File Upload for Board Icons/Banners (未實作)

**位置:** `src/app/boards/create/page.tsx`, `src/components/board/BoardSettingsForm.tsx`

**狀態:** ❌ 目前只支援 URL 輸入

**需要:**

- ❌ 檔案上傳功能（像 media upload）
- ❌ 圖片預覽
- ❌ 圖片裁切/調整大小
- ❌ 儲存到 Supabase Storage

**實作建議:**

```typescript
// 可以重用現有的 media upload API
// 或建立專門的 /api/boards/upload 端點
```

---

### 3. Board Member Management (部分未實作)

**位置:** 未建立

**需要:**

- ❌ 在 board members 加入 "Members" tab
- ❌ 顯示 board members 列表
- ❌ Kick member 功能（owners/mods）
- ❌ 查看 member join date
- ❌ Member count 即時更新

**API 需求:**

- ❌ GET /api/boards/[slug]/members
- ❌ DELETE /api/boards/[slug]/members/[userId]

---

### 4. Ban Management UI (完全未實作)

**改位置:** `src/components/board/BoardSettingsForm.tsx` => Board Member Management

**狀態:** ❌ 完全未實作

**需要:**

- ❌ 在 board members 加入 "Bans" tab
- ❌ 顯示已封禁使用者列表
- ❌ "Ban User" 按鈕和表單
- ❌ "Unban" 按鈕功能
- ❌ 顯示封禁原因和到期時間

**API 狀態:** ✅ 已完成（GET/POST/DELETE 都已實作）
改到 Board Member Management 架構下:

- GET /api/boards/[slug]/bans
- POST /api/boards/[slug]/bans
- DELETE /api/boards/[slug]/bans

**實作建議:**

```typescript
// 需要建立:
// 1. 顯示封禁列表
// 2. 封禁表單（user_id, reason, expires_at）
// 3. 連接到 /api/boards/[slug]/bans
```

### 5. Board Statistics Dashboard (未實作)

**位置:** 未建立

**需要:**

- ❌ Posts per day/week/month 圖表
- ❌ Member growth 圖表
- ❌ Top contributors
- ❌ Activity heatmap

---

## 🟡 現有功能的增強

### 1. Poll 功能增強

**已實作:** ✅ 基本投票功能

**可增強:**

- ⭐ Poll 到期後自動關閉投票
- ⭐ 顯示投票結束倒數計時
- ⭐ 允許 poll 創建者提前結束投票
- ⭐ 顯示「誰投了什麼」（可選，隱私設置）
- ⭐ 多選投票（目前只支援單選）

---

### 2. Archived Boards 增強

**已實作:** ✅ 基本封存和顯示

**可增強:**

- ⭐ Unarchive 功能（owner 可以解除封存）
- ⭐ 封存原因記錄
- ⭐ 封存前備份
- ⭐ 搜尋封存的 boards

---

### 3. Feed Sorting 增強

**已實作:** ✅ Hot/New/Top/Rising

**可增強:**

- ⭐ Controversial 排序（高爭議的貼文）
- ⭐ 使用者自訂預設排序
- ⭐ 儲存排序偏好到使用者設定
- ⭐ Board 層級的預設排序設定

---

### 4. Board Customization 增強

**已實作:** ✅ Name, description, icon, banner, rules

**可增強:**

- ⭐ 自訂主題顏色（per board）
- ⭐ 自訂 CSS
- ⭐ Post flair 管理（目前使用 tags）
- ⭐ User flair 系統
- ⭐ 歡迎訊息（新成員加入時顯示）
- ⭐ 側邊欄 widgets（可自訂）

---

## 🟢 新功能建議

### 1. Board Discovery

- 🆕 推薦 boards（基於興趣）
- 🆕 Trending boards
- 🆕 Board categories/tags
- 🆕 Board search with filters

---

### 2. Moderation Tools

- 🆕 Auto-moderator rules
- 🆕 Mod queue（待審核內容）
- 🆕 Mod log（版主操作記錄）
- 🆕 Report system（檢舉系統）
- 🆕 Content filters（關鍵字過濾）

---

### 3. Community Engagement

- 🆕 Board events/announcements
- 🆕 Pinned posts
- 🆕 Featured posts
- 🆕 Awards/badges system
- 🆕 Leaderboards

---

### 4. Analytics & Insights

- 🆕 Real-time member count
- 🆕 Engagement metrics
- 🆕 Growth tracking
- 🆕 Content performance analytics

---

## 📋 優先級建議

### High Priority (下一個 session 應該做)

1. **Moderator Management UI** - API 已完成，只差 UI
2. **Ban Member Management UI** - API 已完成，只差 UI
3. **File Upload for Board Assets** - 使用者體驗關鍵功能

### Medium Priority

4. Poll 到期功能
5. Board Member Management
6. Unarchive 功能

### Low Priority (Nice to have)

7. 進階 customization
8. Analytics dashboard
9. Community features

---

## 🔧 技術債務

### 1. Type Safety

- 部分組件缺少完整的 TypeScript 類型定義
- 建議建立 `types/board.ts` 統一管理 board 相關類型

### 2. Error Handling

- API 錯誤訊息需要更友善
- 需要 toast notifications 系統

### 3. Loading States

- 部分操作缺少 loading 指示器
- 需要 skeleton screens

### 4. Testing

- 需要 API endpoint tests
- 需要 UI component tests
- 需要 E2E tests for critical flows

---

## 📝 實作指南

### 下一個 Session 建議順序:

1. **完成 Moderator Management UI** (1-2 小時)
   - 建立 AddModeratorModal
   - 連接 Add/Remove API
   - 測試完整流程

2. **完成 Member / Ban Management UI** (1-2 小時)

3. **File Upload** (2-3 小時)
   - 建立 upload component
   - 整合 Supabase Storage
   - 加入圖片預覽和裁切

Total estimated time: **4-7 小時**

---

## 📚 相關文件

- [Phase 9 Plan](webapp/phase-9-boards-forum.md)
- [Phase M6 Plan](mobile/phase-m6-boards-forum.md)
- [API Documentation](../docs/api-reference.md) _(if exists)_
