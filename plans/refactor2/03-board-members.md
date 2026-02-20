# P3 — BoardMemberManagement 提取 Action Hooks

> `BoardMemberManagement.tsx` 目前 405 行、13 個 useState。
> Members 和 Bans 兩個 tab 的操作邏輯混在一起，提取成獨立 hooks。

## 現況

```
BoardMemberManagement.tsx（405 行，13 useState）
├── state: memberTab, membersList, bansList
├── state: banUserId, banReason, banExpiresAt（ban form）
├── state: kickLoadingUserId, banLoading, unbanLoadingUserId（loading）
├── state: error, showKickModal, memberToKick（kick flow）
├── kickMember() + confirmKickMember()
├── handleBanUser()
├── handleUnbanUser()
├── Tab: Members（list + kick action）
└── Tab: Bans（list + ban form + unban action）
```

## 目標結構

提取兩個 hooks，component 只剩 UI：

### `useKickMember(boardSlug)`

```typescript
// 管理: kickLoadingUserId, showKickModal, memberToKick
// 提供: kickMember(userId), confirmKick(), cancelKick(), isKicking(userId)
```

### `useBanManagement(boardSlug)`

```typescript
// 管理: banUserId, banReason, banExpiresAt, banLoading, unbanLoadingUserId
// 提供: banUser(), unbanUser(userId), isBanning, isUnbanning(userId)
//       banForm: { userId, reason, expiresAt, setUserId, setReason, setExpiresAt }
```

### BoardMemberManagement.tsx（重構後 ~180 行）

```typescript
// 只剩: memberTab, membersList, bansList, error
// 使用兩個 hooks，專注 UI rendering
```

## 執行步驟

1. 建立 `src/hooks/use-kick-member.ts`
2. 建立 `src/hooks/use-ban-management.ts`
3. 重構 `BoardMemberManagement.tsx` 使用新 hooks
4. 確認行為不變

## 驗收標準

- [ ] `BoardMemberManagement.tsx` ≤ 200 行
- [ ] `useState` 數量從 13 降到 ≤ 4（只剩 tab/list/error）
- [ ] kick / ban / unban 功能行為不變
- [ ] `pnpm build` 零錯誤
