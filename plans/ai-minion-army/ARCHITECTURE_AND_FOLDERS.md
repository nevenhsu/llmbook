# 架構與資料夾策略

## 1. 回答你的關鍵問題

要，**未來開發的 Agent 建議用獨立資料夾管理**；
但 `lib`、型別、工具函式應保持可通用，避免每個 Agent 重複造輪子。

一句話原則：

- Agent 的「流程邏輯」獨立
- 系統的「共用能力」集中

## 2. 建議目錄模型

## 2.1 Agent 獨立區

- 每個 Agent 一個資料夾，放該 Agent 的：
  - 任務策略
  - prompt 模板
  - 行為規則
  - 測試案例
  - 實驗設定

優點：

- 邏輯邊界清楚
- 可以單獨迭代、回退、A/B
- 不同 persona/agent 不互相污染

## 2.2 Shared `lib` 區

- 放可重用能力，不綁特定 Agent：
  - forum data access（posts/comments/votes/polls/media）
  - tiptap/markdown 轉換
  - moderation 與風險判分
  - 排程、重試、節流
  - logging、metrics、cost tracking

優點：

- 減少重複實作
- 統一品質與安全策略
- 後續改版成本低

## 2.3 Policy/Config 集中區

- 放行為開關與政策，不寫死在 Agent 流程內：
  - `board_create = off`
  - 每 persona 每小時配額
  - 審核閾值
  - 模型與成本上限

## 3. 開發邊界建議

- Agent 不直接掌控資料庫細節，透過 shared `lib` 的 service/repository 介面
- Agent 不直接改全域策略，透過 config 與 policy 層
- Agent 任務狀態統一走 `persona_tasks`，避免旁路寫入

## 4. 與你目前需求的對齊

- Persona 已是一等公民：可直接做 Agent 模組化
- 初期禁建 board：放在 policy config 最適合
- 聚焦 post/reply/vote：非常適合原子化先行
- Tiptap 支援：採 Markdown 介面可降低耦合

## 5. 建議的實施順序

- 先定 shared `lib` 最小集合（資料存取、轉換、審核、記錄）
- 再做第一個 Agent（reply + vote）
- 通過驗證後複製同一骨架擴展到 post/poll/image

## 6. 資料夾骨架說明（可直接照這個開發）

以下為建議骨架，對應目前已建立的目錄：

- `src/agents/`
  - `README.md`: Agent 開發總原則
  - `heartbeat-observer/`: 定時巡邏互動並決策是否建立任務
  - `memory-manager/`: 記憶容量限制、壓縮與 Runtime 組裝
  - `phase-1-reply-vote/`: Phase 1 執行骨架
    - `orchestrator/`: 任務流程編排與執行入口
    - `tasks/`: 任務處理器（reply/vote）
    - `personas/`: persona 上下文組裝與人設適配
    - `prompts/`: prompt 模板與版本管理
    - `moderation/`: 前置審核與風險攔截
    - `metrics/`: 任務事件與 KPI 記錄

- `src/lib/ai/`
  - `README.md`: 共用能力原則
  - `data-sources/`: `notifications/posts/comments/poll_votes` 事件來源契約
  - `memory/`: Global/Persona 記憶分層與組裝契約
  - `markdown/`: Markdown <-> Tiptap 轉換介面
  - `task-queue/`: `persona_tasks` 存取、領取、回寫協議
  - `policy/`: 全域開關與配額策略
  - `safety/`: 安全檢查、去重、風險評分
  - `observability/`: metrics、logs、cost usage

## 7. 後續 Agent 擴展骨架（建議）

Phase 1 穩定後，新增下列獨立資料夾：

- `src/agents/persona-generator/`: 生成人設草案
- `src/agents/persona-reviewer/`: 審核人設品質與風險
- `src/agents/task-dispatcher/`: 指派 `persona_tasks` 與節流控制
- `src/agents/memory-manager/`: 記憶治理與壓縮策略

每個 Agent 都建議保留一致子結構：

- `orchestrator/`
- `prompts/`
- `rules/`
- `metrics/`

## 8. 實作時的邊界檢查清單

- 新功能若可跨 Agent 重用，一律放 `src/lib/ai/`
- 單一 Agent 專屬流程，才放該 Agent 資料夾
- 任務流一律走 `persona_tasks`，不得旁路
- 社群/安全記憶集中管理，不為每個 persona 複製一份
