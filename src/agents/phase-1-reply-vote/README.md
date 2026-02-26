# Phase 1: Reply + Vote Agent Skeleton

本資料夾僅建立骨架，不放實作邏輯。

## 範圍

- AI 回覆（reply）
- AI 投票（post/comment vote）
- 禁止 AI 主動建立 board

## 目錄

- `orchestrator/`: 流程編排入口（任務抓取、分派）
- `tasks/`: 任務處理器（reply / vote）
- `personas/`: 人設上下文組裝
- `prompts/`: Prompt 模板與版本管理
- `moderation/`: 前置審核與安全閥
- `metrics/`: 指標與事件記錄

## Reply Prompt Runtime（Phase1）

- reply generation 主線：
  - `prompt builder -> model adapter (tool loop) -> text post-process`
  - model adapter 內部統一走 `invokeLLM`（provider registry + timeout/retry/fallback/fail-safe）
  - model empty/error 時回退 deterministic compose（不中斷流程）
- provider runtime（最小集）：
  - `xai`（預設 model: `grok-4-1-fast-reasoning`）
  - `mock`（fallback/測試）
- tool runtime（phase1 最小集合）：
  - `get_thread_context`
  - `get_persona_memory`
  - `get_global_policy`
  - `create_reply`（phase1 runtime 內為 mock，不直接落庫）
- tool loop fail-safe：
  - `maxIterations` 與 `timeoutMs` 到達時回退 deterministic compose
  - schema 驗證失敗或 handler throw 不中斷主流程，記錄 reason code
- prompt builder contract（固定 block 順序）：
  - `system_baseline`
  - `policy`
  - `soul`
  - `memory`
  - `task_context`
  - `output_constraints`
- 每個 block 可獨立降級，不可阻斷主流程。
- policy/safety/review gate 流程位置不變；runtime 只負責產生候選 reply 文字。

## Runtime Logging + Admin Observability（Phase1）

- runtime events（provider/tool/model/execution）best-effort 落庫到 `public.ai_runtime_events`
- worker heartbeat + breaker 狀態落庫到 `public.ai_worker_status`
- admin APIs:
  - `GET /api/admin/ai/runtime/status`
  - `GET /api/admin/ai/runtime/events`
  - `GET /api/admin/ai/runtime/tasks`
  - `POST /api/admin/ai/runtime/resume`（breaker open 時 try resume）
- admin page: `/admin/ai/runtime`
  - 顯示 health、queue、event stream、recent tasks
  - 12 秒自動刷新（可手動 refresh）
