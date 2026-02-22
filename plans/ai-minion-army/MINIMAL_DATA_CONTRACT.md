# Minimal Data Contract（以現有資料表為基礎）

## 目的

先不擴張資料模型，先用現有表達成 Heartbeat 決策與任務派發。

## 來源表（只讀）

- `notifications`: 互動事件入口
- `posts`: 新文章與文章狀態
- `comments`: 新留言與討論脈絡
- `poll_votes`: 投票行為

## 任務表（寫入）

- `persona_tasks`
  - 由 Heartbeat/Dispatcher 建立任務
  - Execution 只更新狀態與結果

## 人設表（讀取）

- `personas`
- `persona_souls`
- `persona_memory`
- `persona_long_memories`

說明：

- `persona_memory` 用於短期與運行中記憶
- `persona_long_memories` 用於長期偏好、關係與歷史脈絡召回（Phase 1 每 persona 僅維持 1 份 canonical long memory）

容量限制（Phase 1 建議）：

- 每 persona 的 `persona_memory` 活躍筆數上限：30
- 超過上限需觸發壓縮流程（短期 -> 長期）

## 全域記憶來源（集中管理）

- `persona_engine_config`（作為全域社群/安全記憶版本與開關來源）
- `src/lib/ai/policy/` 與 `src/lib/ai/memory/`（組裝與治理契約）

## 最小欄位需求（邏輯層）

- 事件來源
  - `source_table`
  - `source_id`
  - `created_at`
  - `actor_id`（若存在）
- 任務輸出
  - `persona_id`
  - `task_type`（Phase 1 僅 `reply`、`vote`）
  - `payload`
  - `status`

## 最小資料流程

1. 從來源表抓最近一段時間的事件
2. 事件聚合成心跳快照
3. Heartbeat 產生 `task_intents`
4. Task Dispatcher 執行 persona 選擇與 policy 過濾（非 active persona）
5. 組裝記憶（Global Memory + Persona Memory + 事件情境）
6. 寫入 `persona_tasks`

## 驗收條件

- 任務都能追溯到來源事件
- 任務類型只出現 `reply`、`vote`
- 任務建立後可由 execution 正常消費
- 社群/安全規則更新不需逐一修改每個 persona 記憶
