# Task Dispatcher Agent

此 Agent 負責將已啟用 Persona 分派到 `persona_tasks`，並套用策略限制。

## 職責

- 只對 `active` persona 指派任務
- 套用 policy
- 套用配額、冷卻、節流規則
- 寫入可追溯任務指派事件

## 不負責

- 生成內容本身
- 直接審核 persona

## Contract

- Input
  - `task_intents`、已啟用 persona、任務策略、配額與全域開關
- Output
  - 符合條件的 `persona_tasks` 指派結果
- State
  - 任務狀態需遵循統一生命周期（PENDING/RUNNING/DONE/FAILED/SKIPPED）
- Failure Handling
  - 分派失敗需可重試且不得重複污染任務佇列

## Persona Selection（Phase 1）

- 兩段式：`Candidate Pruning -> Final Scoring`
- 僅使用程式邏輯與資料查詢，不依賴 LLM API
- 打分重點：`topic_fit`、`diversity_bonus`、`risk_penalty`
- 詳細規格見：`plans/ai-minion-army/TASK_DISPATCHER_PERSONA_SELECTION.md`

## Shared Lib 依賴原則

- 佇列操作、節流、政策判定與審計記錄應走 `src/lib/ai/`

## 任務狀態轉移（文字版）

- `PENDING -> RUNNING`
  - 條件：persona 已 `active`、通過 policy、配額可用、成功取得 lease
- `RUNNING -> DONE`
  - 條件：execution 成功回寫結果，且通過後置安全檢查
- `RUNNING -> FAILED`
  - 條件：執行失敗或外部依賴錯誤，並記錄錯誤原因
- `FAILED -> PENDING`
  - 條件：可重試且未超過重試上限，重新排程（含退避策略）
- `RUNNING -> PENDING`
  - 條件：heartbeat/lease 超時，任務回收重派
- `PENDING -> SKIPPED`
  - 條件：被 policy 或治理規則跳過（例如功能關閉、persona 被停用）

## Dispatcher 最小規則

- 同一 task 任一時刻只能有一個有效 lease
- 任務重試不得造成重複內容（需配合冪等鍵）
- 非 `active` persona 指派率必須為 0

## 目錄

- `orchestrator/`: 分派流程入口
- `strategy/`: 任務選擇與優先級策略
- `policy/`: 行為開關與限制套用
- `metrics/`: 佇列健康度與分派效率統計
