# Remaining Tasks & Session Handoff

> Last updated: 2026-02-07
>
> Scope: Webapp board forum (Phase 9 / M6 related)

---

## Current Status (已完成)

### 1) Moderator Management

- ✅ Board Settings 已可新增 moderator（含搜尋使用者）
- ✅ 已可移除 moderator（owner 不可移除）
- ✅ 已可編輯 moderator permissions
- ✅ API 已齊全：
  - `GET/POST /api/boards/[slug]/moderators`
  - `DELETE/PATCH /api/boards/[slug]/moderators/[userId]`

### 2) Member & Ban Management

- ✅ 已搬到獨立頁：`/boards/[slug]/member`
- ✅ Member 清單可查看（public 可看）
- ✅ Ban 清單可查看（public 可看）
- ✅ Kick/Ban/Unban 僅有權限者可操作
- ✅ 權限規則：
  - 只有 owner 或 `manage_users = true` 的 manager 可編輯 ban list / kick
  - 無權限者可看但按鈕 disabled

### 3) Board 頁 UI 導覽

- ✅ Desktop sidebar 新增獨立 `Board Management` card（獨立於 Community Rules card）
- ✅ `Board Management` card 放在 Join 區塊後、Community Rules 前
- ✅ Mobile board header 右側 dropdown 可快速前往 Members/Settings
- ✅ Compact article 列表調整為上下 `padding`（避免 hover 背景衝突）

---

## Important Behavior Notes

1. `/boards/[slug]/member`
   - 所有人可進入查看
   - 只有 owner/manager 可執行動作（kick/ban/unban）

2. `/boards/[slug]/settings`
   - 仍是 moderator/owner 可進入（一般使用者不可）

3. Board Management card
   - `Members & Bans` 對所有人顯示
   - `Board Settings` 僅對可管理者顯示（避免無權限誤導）

---

## Remaining Tasks (下一個 session 可接著做)

### High Priority

1. File Upload for Board Icon/Banner
   - `src/app/boards/create/page.tsx`
   - `src/components/board/BoardSettingsForm.tsx`
   - 目前只有 URL input，尚未做 upload + preview + crop + storage

2. Board Statistics Dashboard
   - 尚未建立
   - 需求：post/member 趨勢、top contributors、activity 指標

### Medium Priority

3. Poll enhancement
   - poll 到期自動關閉
   - 倒數顯示

4. Unarchive flow
   - 目前只有 archive，無 unarchive

---

## Next Session Suggested Start

1. 先做 Board File Upload（最影響使用者體驗）
2. 補 API + UI（upload、preview、error/loading）
3. 跑 `npm run build` 驗證

---

## Key Files Changed This Session

- `src/app/boards/[slug]/member/page.tsx`
- `src/components/board/BoardMemberManagement.tsx`
- `src/components/board/BoardManageCard.tsx`
- `src/components/board/BoardInfoCard.tsx`
- `src/components/board/BoardLayout.tsx`
- `src/components/board/BoardSettingsForm.tsx`
- `src/components/post/PostRow.tsx`
- `src/app/boards/[slug]/page.tsx`
- `src/app/boards/[slug]/settings/page.tsx`
- `src/app/api/boards/[slug]/members/route.ts`
- `src/app/api/boards/[slug]/members/[userId]/route.ts`
- `src/app/api/boards/[slug]/bans/route.ts`
- `src/app/api/boards/[slug]/bans/[userId]/route.ts`
- `src/lib/board-permissions.ts`

---

## Validation Snapshot

- ✅ `npm run build` passed on latest state
- ⚠️ daisyUI `@property` warning still appears (non-blocking)
