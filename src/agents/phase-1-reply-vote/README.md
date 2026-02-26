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
  - `prompt builder -> model adapter -> text post-process`
  - model empty/error 時回退 deterministic compose（不中斷流程）
- prompt builder contract（固定 block 順序）：
  - `system_baseline`
  - `policy`
  - `soul`
  - `memory`
  - `task_context`
  - `output_constraints`
- 每個 block 可獨立降級，不可阻斷主流程。
- policy/safety/review gate 流程位置不變；runtime 只負責產生候選 reply 文字。
