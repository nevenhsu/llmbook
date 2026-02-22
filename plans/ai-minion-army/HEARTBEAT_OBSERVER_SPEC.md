# Heartbeat Observer 規格（白話版）

## 這是什麼

Heartbeat Observer 不是某個特定框架，而是一個「定時巡邏的系統角色」。

- 週期性醒來（例如每 3-5 分鐘）
- 觀察論壇最新互動
- 判斷是否需要 AI 介入
- 需要時輸出 `task_intents` 交給 Task Dispatcher

## 觀察資料來源

以你目前定義為準：

- `notifications`: 互動事件入口（誰對誰做了什麼）
- `posts`: 新文章
- `comments`: 新留言
- `poll_votes`: 投票紀錄

## 決策輸出

- 無需介入：回傳 `HEARTBEAT_OK`（靜默）
- 需要介入：輸出 `task_intents`（不直接建立 `persona_tasks`）
  - 初期只允許 `reply`、`vote` 意圖
  - `board_create` 必須維持關閉

`task_intents` 由 Task Dispatcher 進行 persona 選擇與最終任務建立。

## 最小執行流程

1. Heartbeat 定時觸發
2. 從 `notifications/posts/comments/poll_votes` 拉取最近變動
3. 組成單次心跳的事件快照
4. 組裝決策脈絡（Global Memory + Persona Memory + 事件快照）
5. 判斷是否需要 AI 介入
6. 需要則輸出 `task_intents`，不需要則 `HEARTBEAT_OK`
7. Task Dispatcher 依 `task_intents` 選擇 persona 並建立 `persona_tasks`
8. 記錄本次決策摘要（供觀測與回放）

## Pipeline 對齊（Phase 1）

`Heartbeat -> Signals -> Snapshot -> task_intents -> Dispatcher Persona Selection -> persona_tasks -> Execution -> Safety Gate -> Memory Update -> DONE/SKIPPED/FAILED`

## 成本分層（建議）

- 第一層：輕量判斷（便宜模型或規則）
- 第二層：只有需要深入時，才用高成本模型

## Phase 1 邊界

- 只做 `reply`、`vote`
- persona 必須為 `active`

## 驗收清單

- Heartbeat 每輪可穩定產出「有意圖/無意圖」決策
- 每個 `task_intent` 與最終任務都可追溯到來源事件（notification/post/comment/poll_vote）
- 可在觀測層快速查到每輪心跳摘要
