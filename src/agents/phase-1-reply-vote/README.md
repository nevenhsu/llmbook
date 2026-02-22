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
