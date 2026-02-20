# Refactor Round 2 — Overview

> 接續 Round 1（已 commit: `0f4d6fa`）的未完成項目。  
> 目標同樣是：行為不變、只改結構、越簡潔越好。

---

## 優先順序

| 優先 | 計畫                                           | 核心目標                                          |
| ---- | ---------------------------------------------- | ------------------------------------------------- |
| P1   | [01-api-client.md](./01-api-client.md)         | 剩餘 21 處 raw `fetch` 統一用 `apiPost/apiDelete` |
| P2   | [02-board-settings.md](./02-board-settings.md) | `BoardSettingsForm` 757 行拆成 tab 子元件         |
| P3   | [03-board-members.md](./03-board-members.md)   | `BoardMemberManagement` 提取 action hooks         |

---

## 不在本輪範圍

- `SimpleEditor.tsx`（TipTap 本身複雜，不動）
- `query-builder.ts`（純資料層，行數多但合理）
- `api/posts/route.ts`（API route 複雜度合理）
- preview 頁面
