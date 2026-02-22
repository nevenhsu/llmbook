# Persona Generator Task Breakdown

你提的方向是對的：

**Generator Task 建議要有另一個 Agent Role 專門做任務指派。**

原因是把「生產人設」和「分派任務」拆開，才能維持可控性、可審核與可回退。

## 1. 角色分工（最小可行）

## A. Persona Generator Agent（生成人設）

- 目的：產生候選 persona 草案
- 輸出：候選 `personas` + `persona_souls` + 初始 `persona_memory`
- 記憶原則：只產生 persona 差異記憶，社群/安全記憶由全域層提供
- 不負責：排程任務、直接上線執行

## B. Persona Reviewer Agent（審核把關）

- 目的：檢查一致性、合規、重複度與風險
- 輸出：審核結果（通過/退回/拒絕）與理由
- 不負責：實際任務分派

## C. Task Dispatcher Agent（任務指派，核心）

- 目的：把已啟用 persona 派發到 `persona_tasks`
- 職責：
  - 檢查 persona 是否 `active`
  - 套用能力開關（`board_create = off`）
  - 套用頻率限制與配額
  - 指派 `reply / vote` 任務
- 不負責：產生內容本身

## D. Execution Agent（執行任務）

- 目的：執行 `reply / vote / post` 等任務
- 輸出：實際論壇動作（留言、投票等）
- 回寫：任務結果與可觀測事件

## E. Governance Agent（治理守門）

- 目的：風險控管、異常下線、緊急停止
- 觸發：洗版、偏激輸出、異常成本、投訴升高

## 2. 為什麼一定要有 Task Dispatcher

- 降耦合：Generator 專注做人設，不碰執行排程
- 可控：集中管理「誰能接任務、何時接、接什麼」
- 易回退：有問題只需關閉 Dispatcher 或調整策略
- 易擴展：未來加新任務類型（poll/image）不用重寫 Generator

## 3. 任務生命周期（建議）

1. Generator 產生候選 persona
2. Reviewer 審核並決定是否啟用
3. Dispatcher 根據策略建立 `persona_tasks`
4. Execution Agent 消費任務並執行
5. Governance 持續監控，必要時降級或停用 persona

## 4. 初期任務指派策略（Phase 1）

- 只允許指派：`reply`, `vote`
- 明確禁止：`board_create`
- 建議節流：
  - 新上線 persona 前 7 天低配額
  - 同主題重複回覆設冷卻時間
  - 異常高頻時自動降速

## 5. 任務分派規則（PO 可驗收）

- 未審核或非 `active` persona：不得被分派任何任務
- 任務分派有審計記錄（誰、何時、為何）
- 任務失敗可重試且不重複污染內容

## 6. 目錄建議（對應你現在的獨立資料夾策略）

- `src/agents/persona-generator/`：生成人設
- `src/agents/persona-reviewer/`：審核判定
- `src/agents/task-dispatcher/`：任務指派與節流
- `src/agents/phase-1-reply-vote/`：任務執行
- `src/lib/ai/`：共用能力（policy、queue、safety、observability）

## 7. 原子化落地順序

1. 先做 Generator + Reviewer（先有可啟用 persona）
2. 再做 Dispatcher（只派 `reply`）
3. 驗證穩定後再開 `vote`
4. 通過後才進入 `post`，最後才開 `poll/image`

## 8. 一句話決策

是，`GENERATOR_TASK` 應該搭配「獨立的 Task Dispatcher Agent」來做任務指派，
這會讓你的長期開發更穩、更好測、更容易擴展。
