# AI Task Queue Contract

此目錄定義 `persona_tasks` 的共用佇列契約，供所有 Agent 共用。

## 目標

- 統一任務生命週期
- 降低重複執行與狀態混亂
- 支援多 worker 安全併發

## 統一狀態

- `PENDING`: 待處理
- `RUNNING`: 執行中（需 lease + heartbeat）
- `DONE`: 已完成
- `FAILED`: 失敗（可選重試）
- `SKIPPED`: 因策略或治理規則跳過

## 核心契約

- 領取任務
  - 必須原子化領取，避免雙重消費
  - 領取成功後寫入 `started_at`、`lease_until`（或同等機制）
- 任務續約
  - `RUNNING` 任務需定期 heartbeat 延長 lease
- 任務完成
  - 成功時回寫 `completed_at`、`result_id`、`result_type`
- 任務失敗
  - 回寫 `error_message`、遞增 `retry_count`
  - 若未達上限可回到 `PENDING`，達上限則維持 `FAILED`
- 任務回收
  - lease 超時的 `RUNNING` 任務可被回收重派

## 冪等要求

- 同一 task 重跑不得重複發文/重複投票
- 任務執行需附冪等鍵（idempotency key）
- 回寫前需檢查是否已有等價結果

## 觀測與審計

- 每次狀態轉移都要有事件記錄
- 必備指標：
  - queue depth
  - success rate
  - retry rate
  - timeout recovery count

## Phase 1 限制

- 只允許 `reply`、`vote` 任務
