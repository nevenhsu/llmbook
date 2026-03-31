# Refactor: AI Agent Preview & Admin Panel Route Reorganization

## 目的

建立 preview/admin 一對一路由配對，讓每個 preview 頁面都有對應的 admin panel：

- **Preview 頁面**：純 UI 調整用（mock JSON），不需 auth、不接 DB
- **Admin 頁面**：完整功能（fixture + runtime DB），需 admin auth

## 目標路由配對

| Preview 路由              | Admin 路由              | 內容       |
| ------------------------- | ----------------------- | ---------- |
| `/preview/ai-agent-lab`   | `/admin/ai/agent-lab`   | Lab 工具   |
| `/preview/ai-agent-panel` | `/admin/ai/agent-panel` | Panel 工具 |

### 各路由說明

| 路由                      | 資料來源                            | Auth           | 用途           |
| ------------------------- | ----------------------------------- | -------------- | -------------- |
| `/preview/ai-agent-lab`   | mock JSON（overview + intake）      | None           | Lab UI 調整    |
| `/admin/ai/agent-lab`     | fixture + runtime DB                | Admin required | Lab 完整功能   |
| `/preview/ai-agent-panel` | `src/mock-data/ai-agent-panel.json` | None           | Panel UI 調整  |
| `/admin/ai/agent-panel`   | runtime DB（三 store）              | Admin required | Panel 完整功能 |

## 要做的事

### 1. 建立 Mock JSON 檔案

#### 1.1 `src/mock-data/ai-agent-panel.json`

- **來源**: 從 `buildMockAiAgentOverviewSnapshot()` 轉成真實 JSON
- **內容**: 包含完整的 `config`, `queue`, `usage`, `checkpoints`, `latestRun`, `recentTasks`, `recentRuns`, `recentMediaJobs`, `runtimeState`
- **格式**: 對應 `AiAgentOverviewSnapshot` type

#### 1.2 `src/mock-data/ai-agent-lab.json`

- **來源**: 結合 `buildMockAiAgentOverviewSnapshot()` + `buildMockIntakeRuntimePreviews()`
- **內容**:
  - `initialSnapshot`: 同 `ai-agent-panel.json` 的 `AiAgentOverviewSnapshot`
  - `runtimePreviews.notification`: `AiAgentRuntimeSourceSnapshot`（notification intake）
  - `runtimePreviews.public`: `AiAgentRuntimeSourceSnapshot`（public intake）
- **格式**: 對應 `AiAgentLabPage` props shape

### 2. 建立 `/preview/ai-agent-panel/page.tsx`

- **類型**: Client component（不需要 auth、不接 DB）
- **功能**:
  - 讀取 `src/mock-data/ai-agent-panel.json`
  - 附狀態切換按鈕：`[Default]` `[Empty]` `[Reset]`
  - **Default**: 完整 mock 資料
  - **Empty**: 所有 arrays 清空、queue 歸零、runtimeState 設為 unavailable
  - **Reset**: 回到 Default 狀態
- **渲染**: `<AiAgentPanel initialSnapshot={mockData} runtimePreviews={null} runtimeMemoryPreviews={null} />`

### 3. 重建 `/preview/ai-agent-lab/page.tsx`

- **類型**: Client component（不需要 auth、不接 DB）
- **功能**:
  - 讀取 `src/mock-data/ai-agent-lab.json`
  - 附狀態切換按鈕：`[Default]` `[Empty]` `[Reset]`
  - **Default**: 完整 mock 資料（overview + intake runtime previews）
  - **Empty**: overview 清空 + runtimePreviews 設為 null
  - **Reset**: 回到 Default 狀態
- **渲染**: `<AiAgentLabPage initialSnapshot={mockData.initialSnapshot} runtimePreviews={mockData.runtimePreviews} />`
- **保留**: 所有 Lab Controls 功能（fixture mode、step-by-step pipeline、JSON preview cards）

### 4. 搬移 `/admin/ai/agent-panel` → `/admin/ai/agent-lab`

- **來源**: `/admin/ai/agent-panel/page.tsx`
- **目標**: `/admin/ai/agent-lab/page.tsx`
- **保留**: 完整 runtime DB 邏輯（`AiAgentOverviewStore`, `AiAgentIntakePreviewStore`, `AiAgentMemoryPreviewStore`）
- **保留**: admin auth guard

### 5. 保留 `/admin/ai/agent-panel/page.tsx`

- 保持不變，繼續作為 AI Agent Panel 的 admin 入口
- 完整 DB 連接 + admin auth guard

## 狀態切換 UI 規格

```
┌─────────────────────────────────────────────────────┐
│ AI Agent Panel                                      │
│                                                     │
│ [Default ▼] [Empty] [Reset]                         │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Queue Total: 8    Pending: 2                    │ │
│ │ ...                                             │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

- 按鈕使用 DaisyUI `btn btn-sm` 樣式
- 當前狀態按鈕顯示為 `btn-neutral`，其他為 `btn-outline`
- Empty 狀態下所有列表/表格顯示 "No data available" 或類似空狀態

## 影響範圍

- **不影響**: `AiAgentPanel`、`AiAgentLabPage` 等 component 邏輯
- **不影響**: 現有測試（`AiAgentPanel.test.ts`、`AiAgentLabPage.test.ts`）
- **不影響**: `buildMockAiAgentOverviewSnapshot()`、`buildMockIntakeRuntimePreviews()`（保留給測試使用）
- **影響**: 路由位置變更，需更新任何外部連結或導覽列
