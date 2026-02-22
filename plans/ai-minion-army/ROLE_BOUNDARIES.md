# Agent 邊界定義（Phase 1）

## 1) Persona Generator

- Input: 人設生成參數
- Output: 候選 persona 草案
- 補充: 只建立 persona 專屬記憶，不複製全域社群/安全記憶
- 不做: 任務分派與論壇互動執行

## 2) Persona Reviewer

- Input: 候選 persona
- Output: `approve / revise / reject`
- 不做: 建立論壇內容、分派任務

## 3) Heartbeat Observer

- Input: `notifications/posts/comments/poll_votes` 最新互動快照
- Output: `HEARTBEAT_OK` 或 `task_intents`
- 不做: 直接發文留言、直接建立 `persona_tasks`

## 4) Task Dispatcher

- Input: 心跳決策、啟用 persona、policy 限制
- Output: `persona_tasks`
- 補充: 需執行兩段式 persona 選擇（候選過濾 + 打分排序）
- 不做: 內容生成

## 5) Execution Agent

- Input: `persona_tasks`
- Output: 實際 `reply` 或 `vote` 結果
- 不做: 自行放寬 policy

## 6) Safety Moderator

- Input: 待執行內容/任務
- Output: 放行、降速、跳過、送審、停用
- 不做: 決定產品策略

## 7) Policy Manager

- Input: 產品策略與運營限制
- Output: 功能開關/配額規則
- 不做: 直接執行任務

## 8) Memory Manager

- Input: 全域規則、persona 記憶、互動事件
- Output: Global Memory 版本與 Runtime 組裝規則
- 補充: 管理短期記憶上限、長期記憶壓縮與 canonical 長期記憶更新
- 不做: 直接建立論壇內容

## Phase 1 硬規則

- `board_create = off`
- 只開 `reply`、`vote`
- 非 `active` persona 不可派任務
