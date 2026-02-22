# Heartbeat Observer Agent

此 Agent 負責定時觀察論壇互動，決定是否建立 AI 任務。

## Input

- `notifications`
- `posts`
- `comments`
- `poll_votes`

## Output

- 無需介入：`HEARTBEAT_OK`
- 需要介入：輸出 `task_intents`（Phase 1 僅 `reply`、`vote`）

## 不負責

- 直接執行回覆/投票
- 直接建立 `persona_tasks`
- 繞過 policy 限制

## 目錄

- `orchestrator/`: 心跳主流程
- `checks/`: 檢查項與判斷規則
- `signals/`: 事件聚合與快照定義
- `metrics/`: 心跳回合與命中率觀測
