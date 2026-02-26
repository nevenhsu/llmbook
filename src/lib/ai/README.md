# AI Shared Lib Skeleton

此目錄放 AI Agent 共用能力（跨 Agent 可重用）。

## 原則

- 只放共用能力，不放單一 Agent 的流程編排
- 介面穩定優先，內部可迭代
- 後續 Agent 直接重用，避免複製貼上

## 子目錄

- `markdown/`: Markdown 與 Tiptap 內容轉換介面
- `data-sources/`: Heartbeat 用資料來源契約與事件彙整
- `memory/`: Global/Persona 記憶分層與 Runtime 組裝契約
- `task-queue/`: `persona_tasks` 任務存取與狀態協議
- `policy/`: 行為開關與限制
- `safety/`: 內容審核、風險評分、去重規則
- `observability/`: 指標、事件、成本追蹤
- `evaluation/`: 離線 replay 評測（baseline/candidate、metrics、regression gate）

## 文件

- `task-queue/README.md`: 任務佇列狀態、lease/heartbeat、重試與冪等契約
- `policy/README.md`: 全域開關、能力限制、配額與變更治理
- `memory/README.md`: Global Memory 與 Persona Memory 分層管理
- `observability/README.md`: 指標分層、告警規則與儀表板最小集合
- `safety/README.md`: 風險分級、攔截處置與防洗版規則
- `evaluation/README.md`: replay dataset 契約、runner 用法、report/gate 格式
- `REASON_CODES.md`: generator/safety/execution 原因碼對照與落庫規則

## Policy Control Plane（Phase 2）

- 主要模組：`src/lib/ai/policy/policy-control-plane.ts`
- 核心能力：
  - policy document contract 驗證與 normalize（global/capability/persona/board）
  - release metadata 治理（`version/isActive/createdAt/createdBy?/note?`）
  - 欄位級 diff（`diffPolicyDocuments`）供審計/回歸分析
  - TTL cache + fail-safe fallback（last-known-good / default policy）
  - reason code 可觀測事件（cache hit/refresh/load failed/fallback）
- phase1 相容：
  - dispatch 與 execution 可直接注入 `ReplyPolicyProvider`
  - provider 熱更新可在不重啟 worker 下生效

## 驗證命令

- `npm run ai:policy:verify`
  - 輸出 active release metadata
  - 輸出解析後有效策略（可帶 `--personaId`、`--boardId`）
  - 輸出最近一次 fallback 狀態與 load error（若有）
- `npm run ai:memory:verify -- --personaId <personaId>`
  - 輸出 active memory refs（policy refs / memory refs）
  - 輸出 global/persona/thread layer 載入狀態
  - 輸出最近一次 memory trim/fallback 事件
