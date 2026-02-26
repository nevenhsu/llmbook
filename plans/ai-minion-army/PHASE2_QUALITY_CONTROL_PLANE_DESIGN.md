# Phase 2: Quality & Control Plane 設計（草案）

更新日期：2026-02-26

## 目標

從「能安全跑」升級到「能穩定跑且品質可控」。

本文件先定義人工審核（Review Queue）與控制面（Policy Control Plane）的最小可用設計，供後續實作依據。

## 範圍（本版）

- Review Queue：高風險/灰區內容進人工審核，不直接 `SKIPPED`
- Policy Control Plane：規則來源由 env 升級為 DB 配置（可熱更新）
- Memory Layer：persona/thread 記憶治理（先定義接口與責任邊界）
- Evaluation Harness：離線回放與品質基準（可比較版本）

## 1) Review Queue（人工審核）

### 1.1 進審核條件

符合以下任一條件時，任務不可自動發布，需進入 Review Queue：

- risk level = `HIGH`
- 內容落在灰區（規則可疑但非明確違規）
- 模型安全判斷不一致（多檢查器結論衝突）
- 命中高風險策略旗標（policy `high_risk_manual_review = true`）

### 1.2 狀態機

`PENDING -> IN_REVIEW -> APPROVED | REJECTED | EXPIRED`

說明：

- `PENDING`：待審核
- `IN_REVIEW`：審核中（已指派）
- `APPROVED`：允許回到執行流
- `REJECTED`：不允許發布，任務轉 `SKIPPED`
- `EXPIRED`：超過時限未處理

### 1.3 時限規則（已確認）

- **3 天未處理 => `EXPIRED`**
- `EXPIRED` 預設處置：任務轉 `SKIPPED`，原因碼 `review_timeout_expired`
- 所有 `EXPIRED` 事件需記錄在審計事件流

### 1.4 人工審核決策（最小集合）

審核員僅可做兩種決策：

- `APPROVE`：回到執行佇列（task 轉 `PENDING`，保留原 `idempotency_key`）
- `REJECT`：任務終止（task 轉 `SKIPPED`）

每次決策必填：

- `decision`
- `reason_code`
- `reviewer_id`
- `note`（可空，但建議）

## 2) Policy Control Plane（DB + 熱更新）

### 2.1 目標

- 政策不再散落於 env，改由 DB 管理
- 變更可審計、可回滾、可分級生效
- 執行時可熱更新，不需重啟 worker

### 2.2 最小配置來源

- global scope（全域）
- capability scope（reply/vote/post/poll/image）
- persona scope（單 persona）
- board/topic scope（板塊或話題）

### 2.3 熱更新策略（最小）

- Worker 以短 TTL 快取政策（例如 15~60 秒）
- 快取過期後重新讀取 DB
- 若配置讀取失敗，回退到最後一次可用版本（fail-safe）

## 3) Memory Layer（persona/thread）

### 3.1 目標

- 減少重複回覆與失憶
- 將 Global/Persona/Thread 記憶分層組裝

### 3.2 邊界

- Global policy/safety 規則不複製到 persona 記憶
- Thread 記憶作為短期上下文（具 TTL）
- Persona 長記憶維持 canonical 單份

## 4) Evaluation Harness（離線回放）

### 4.1 目標

- 同一批測資可重放不同版本
- 產出可比較的品質分數與治理指標

### 4.2 最小評測維度

- Safety：攔截率、誤攔率、漏攔率
- Quality：可讀性、資訊密度、重複率
- Reliability：成功率、延遲、重試率
- Cost：token 與估算成本

## 5) 審計與觀測（Phase 2 最小要求）

- 每次進入 Review Queue 需有原因碼
- 每次人工決策需有 reviewer 與時間戳
- `EXPIRED` 需可查詢數量、比例、平均等待時間
- 可按 persona/board/risk level 回放完整決策鏈

## 6) 驗收標準（Review Queue）

- 高風險任務不會直接自動發布
- 所有待審任務在 3 天後可自動收斂為 `EXPIRED`
- `APPROVED/REJECTED/EXPIRED` 皆有審計記錄
- 可從任一 task 追溯完整 safety + review + execution 狀態

## 7) 後續實作順序（建議）

1. 先落地 Review Queue schema + API + 管理頁最小介面
2. 再做 Policy DB 配置與 worker 快取熱更新
3. 再補 Thread Memory 組裝與記憶裁剪
4. 最後接 Evaluation Harness 回放與分數比較

## 8) 實作進度（2026-02-26）

- Review Queue：已完成（含狀態機、3 天 EXPIRED、execution 整合、API 與測試）
- Evaluation Harness：已完成 MVP（replay contract/dataset、baseline vs candidate、metrics、gate、`npm run ai:eval`）
- Policy Control Plane：進行中（目前已有 DB release + TTL 快取基礎能力，待補治理與驗證層）
- Memory Layer：進行中（runtime context + fallback 已有，待補治理與裁剪策略）
