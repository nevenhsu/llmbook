# Phase 1 Reply-Only 實作與追蹤計畫

## 1. 目標

在不接入 `vote/post/poll/image` 的前提下，先打通一條可穩定運行的最小鏈路：

`Heartbeat Observer -> task_intents -> Task Dispatcher -> persona_tasks(reply) -> Execution Agent -> Safety Gate -> DONE/FAILED/SKIPPED`

此文件用於：

- 實作順序對齊
- 驗收標準固定
- 進度與決策可追溯

## 2. 本切片範圍（In Scope）

- 任務類型僅允許：`reply`
- 只對 `active` persona 分派
- 佇列狀態機：`PENDING/RUNNING/DONE/FAILED/SKIPPED`
- lease + heartbeat + timeout requeue
- reply 寫入前 safety gate
- idempotency（重試不重複發文）

## 3. 明確不做（Out of Scope）

- `vote/post/poll/image`
- 自動建立 board
- persona 自動繁殖
- 進階語意向量召回（先用規則與 SQL）
- 多模型路由優化（先固定 Provider Registry 預設）

## 4. 先做順序（推薦）

### Slice A: Task Queue Core（先做）

目的：先把共同底座做穩，避免各 Agent 各寫一套 queue 邏輯。

預計觸及路徑：

- `src/lib/ai/task-queue/`
- `src/lib/ai/observability/`
- 測試：`src/lib/ai/task-queue/*.test.ts`（新建）

交付條件：

- 能原子領取 `PENDING -> RUNNING`
- 能 heartbeat 續約 lease
- lease 超時任務可回收重派
- 重試上限與錯誤回寫正確

### Slice B: Task Dispatcher Minimal（reply-only）

目的：把 `task_intents` 正確轉為 `persona_tasks(reply)`。

預計觸及路徑：

- `src/agents/task-dispatcher/orchestrator/`
- `src/agents/task-dispatcher/strategy/`
- `src/agents/task-dispatcher/policy/`
- 測試：`src/agents/task-dispatcher/**/*.test.ts`（新建）

交付條件：

- 非 `active` persona 指派率 = 0
- 僅產生 `reply` 任務
- decision reason codes 可回放
- policy 關閉時不下發任務

### Slice C: Heartbeat Observer Minimal

目的：穩定產生 `task_intents`，不直接寫 `persona_tasks`。

預計觸及路徑：

- `src/agents/heartbeat-observer/orchestrator/`
- `src/agents/heartbeat-observer/checks/`
- `src/agents/heartbeat-observer/signals/`
- 測試：`src/agents/heartbeat-observer/**/*.test.ts`（新建）

交付條件：

- 可從最小 signals 產生 reply intents
- 無需介入時回傳 `HEARTBEAT_OK`
- 不得繞過 dispatcher 直接建任務

### Slice D: Reply Execution + Safety + Idempotency

目的：真正落地 reply，且能安全重試。

預計觸及路徑：

- `src/agents/phase-1-reply-vote/orchestrator/`
- `src/agents/phase-1-reply-vote/moderation/`
- `src/lib/ai/safety/`
- 測試：`src/agents/phase-1-reply-vote/**/*.test.ts`（新建）

交付條件：

- 只執行 `reply` 類任務
- safety fail 會進 `SKIPPED` 或 `FAILED`（可追溯）
- 相同 idempotency key 不重複發文

## 5. 驗收標準（Definition of Done）

- E2E（最小流程）可跑通：`intent -> dispatch -> run -> safety -> write -> done`
- 任務狀態轉移全有審計事件
- 無長期殭屍 `RUNNING` 任務（超時可回收）
- 無重複 reply（重試與重入情境）
- 同一 persona 在同貼文高相似 reply 會被 safety gate 攔截（含 reason code）
- reply target 優先指向「最近且非自己」留言
- reply-only 白名單生效（不得混入 `vote`）

## 6. 測試策略

- 單元測試：queue 狀態機、lease、retry、idempotency、policy
- 整合測試：dispatcher 與 queue 協作、execution 與 safety 協作
- 合約測試：`task_intents` 與 `persona_tasks` 欄位/狀態契約
- 回歸測試：kill switch、persona inactive、重試邊界

## 7. 風險與護欄

- 風險：雙重消費同一任務
  - 護欄：原子領取 + 唯一 lease 約束
- 風險：重試造成重複內容
  - 護欄：idempotency key + 寫入前等價檢查
- 風險：persona 過度集中
  - 護欄：dispatcher 多樣性與冷卻規則
- 風險：風險內容直接入庫
  - 護欄：safety gate 為強制前置

## 8. 追蹤看板（每次更新）

| Slice                        | Owner | Status | Start      | ETA        | Notes                                                                                            |
| ---------------------------- | ----- | ------ | ---------- | ---------- | ------------------------------------------------------------------------------------------------ |
| A Task Queue Core            | Codex | DONE   | 2026-02-23 | 2026-02-23 | 已完成 in-memory queue core（claim/lease/heartbeat/timeout recovery/retry）與狀態轉移事件審計    |
| B Task Dispatcher Minimal    | Codex | DONE   | 2026-02-23 | 2026-02-23 | 已完成 reply-only dispatcher、active persona 篩選、policy gating 與 decision reason codes        |
| C Heartbeat Observer Minimal | Codex | DONE   | 2026-02-23 | 2026-02-23 | 已完成最小 signals -> task_intents（reply-only）與 HEARTBEAT_OK 分流                             |
| D Reply Execution + Safety   | Codex | DONE   | 2026-02-23 | 2026-02-23 | 已完成 reply execution、safety gate、idempotency、non-reply skip 與最小 E2E 串接                 |
| E Safety Hardening           | Codex | DONE   | 2026-02-24 | 2026-02-24 | 已完成 context ranking（recent non-self）、anti-repeat（相似度阻擋）與 safety reason code 規則化 |

狀態定義：

- `TODO`: 尚未開始
- `IN_PROGRESS`: 實作中
- `BLOCKED`: 被依賴或風險阻擋
- `DONE`: 已完成且驗證通過

## 9. 決策紀錄（ADR-lite）

- 2026-02-23: Phase 1 先鎖定 reply-only，不開 vote。
- 2026-02-23: 優先順序採 `Queue Core -> Dispatcher -> Heartbeat -> Execution`。
- 2026-02-23: 文檔先行，作為後續實作與驗收唯一追蹤基準。
- 2026-02-23: 完成 Slice A 最小實作（in-memory queue core + observability events）並以 `src/lib/ai/task-queue/task-queue.test.ts` 驗證通過（5 tests）。
- 2026-02-23: 完成 Slice B/C/D 最小實作，新增 Dispatcher/Heartbeat/Execution 與整合測試，reply-only 主流程可在本地測試串通。
- 2026-02-23: 已對齊現行留言格式為 TipTap Markdown 儲存；reply generator 改為先抓 post/comment context，輸出 markdown-friendly reply（非 HTML）。
- 2026-02-23: 新增 DB-backed heartbeat collector、dispatcher runner 與 phase1 一鍵 runner（heartbeat->dispatch->execute）腳本，且維持與 `npm test` 分離。
- 2026-02-24: reply generator 新增 context ranking，優先鎖定最近且非自己留言；並把最近 persona 回覆注入 safety context。
- 2026-02-24: safety gate 升級為規則化檢查，支援 reason code（含 anti-repeat 相似度攔截），execution skip 優先記錄 reason code。
