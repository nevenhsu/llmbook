# P2 — BoardSettingsForm 拆分

> `BoardSettingsForm.tsx` 目前 757 行、21 個 useState，管理 4 個 tab 的所有狀態。
> 拆成 4 個獨立 tab 元件，父元件只保留 tab 切換邏輯。

## 現況

```
BoardSettingsForm.tsx（757 行）
├── state: activeTab, loading, error, showArchiveModal
├── state: name, description, bannerUrl（General tab）
├── state: moderatorsList, showAddModeratorModal, searchQuery,
│         searchResults, selectedProfile, searchLoading,
│         actionLoading, removeLoadingUserId,
│         expandedPermissionUserId, editingPermissions,
│         savePermissionsUserId, showRemoveModeratorModal,
│         moderatorToRemove（Moderators tab）
├── Tab: General（board name, description, banner）
├── Tab: Rules（board rules editor）
├── Tab: Moderators（add/remove/permissions）
└── Tab: Danger（archive board）
```

## 目標結構

```
BoardSettingsForm.tsx（~80 行）
├── state: activeTab only
└── renders one of:
    ├── GeneralSettingsTab.tsx（~120 行）
    ├── RulesSettingsTab.tsx（~80 行）
    ├── ModeratorsSettingsTab.tsx（~250 行）
    └── DangerSettingsTab.tsx（~80 行）
```

## 各 Tab 的 Props 設計

### GeneralSettingsTab

```typescript
interface GeneralSettingsTabProps {
  board: Board;
  onSaved: () => void;
}
// 內部管理: name, description, bannerUrl, loading, error
```

### RulesSettingsTab

```typescript
interface RulesSettingsTabProps {
  board: Board;
  onSaved: () => void;
}
// 內部管理: rules state, loading, error
```

### ModeratorsSettingsTab

```typescript
interface ModeratorsSettingsTabProps {
  board: Board;
  moderators: Moderator[];
  onChanged: (moderators: Moderator[]) => void;
}
// 內部管理: 全部 moderator 相關 state（11 個）
```

### DangerSettingsTab

```typescript
interface DangerSettingsTabProps {
  board: Board;
}
// 內部管理: showArchiveModal
```

## 執行步驟

1. 建立 `src/components/board/settings/` 目錄
2. 依序提取各 Tab component（從最簡單的 Danger 開始）
3. 更新 `BoardSettingsForm.tsx` 使用新 components
4. 確認 TypeScript 零錯誤

## 驗收標準

- [ ] `BoardSettingsForm.tsx` ≤ 100 行
- [ ] 每個 Tab component ≤ 250 行
- [ ] 所有 board settings 功能行為不變
- [ ] `pnpm build` 零錯誤
