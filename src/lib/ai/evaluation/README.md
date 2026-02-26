# Evaluation Harness（Offline Replay）

Phase2 Quality Control Plane 的最小可用評測工具，目標是同一批測資可比較 baseline/candidate，並輸出可供 CI 判定的 regression gate。

## 入口

- Script: `npm run ai:eval`
- 核心 runner: `runEvaluationReplay(...)`（`src/lib/ai/evaluation/runner.ts`）

## Replay Data Contract（v1）

`ReplayCase` 必填：

- `schemaVersion`: 目前為 `replay.v1`
- `taskType`: 目前最小支援 `reply`
- `personaId`
- `threadId?`
- `boardId?`
- `intent`（含 `payload`，即 intent/task payload）
- `policyRefs`
- `memorySnapshot`
- `expected?`

`ReplayDataset` 必填：

- `contractVersion`
- `datasetVersion`（baseline/candidate 比較時使用同一版）
- `generatedAt`
- `cases[]`

參考 fixture：

- `src/lib/ai/evaluation/fixtures/minimal-replay-dataset.ts`
- 內容包含：正常案例、precheck block、安全攔截、memory fallback。

## Runner 能力

- 同 dataset 跑 baseline/candidate
- 可注入 policy / memory / safety / generator 實作
- 目前串接現有 phase1 元件：
  - `createReplyDispatchPrecheck`（dispatch precheck path）
  - `ReplyExecutionAgent`（execution path）
- 每 case 輸出：
  - `decision`
  - `reasonCodes`
  - `generated` 摘要
  - `error`
  - `latencyMs`
  - `cost`（token/cost 聚合欄位）

## Metrics & Scoring

最小指標：

- Safety：`interceptRate` / `falseInterceptRate` / `missRate`
- Quality：`repeatRate` / `emptyOutputRate`
- Reliability：`successRate` / `errorRate` / `avgLatencyMs`
- Cost：`totalTokens` / `totalEstimatedUsd`

並輸出 baseline/candidate `diff` 與總分 `score.total`。

## Regression Gate

可配置 gate 規則（`RegressionGateRules`）：

- `maxMissRateIncrease`
- `maxFalseInterceptRateIncrease`
- `maxSuccessRateDrop`
- `maxErrorRateIncrease`
- `maxAvgLatencyIncreaseMs`

runner 回傳：

- `gate.passed`
- `gate.failures[]`（含 rule、delta、message）

CI 可直接依 `gate.passed` 決定 pass/fail。

## Report JSON

預設輸出：

- `reports/ai-eval/latest.json`

欄位主結構：

- `summary`
- `baseline`（`caseResults` + `metrics`）
- `candidate`（`caseResults` + `metrics`）
- `diff`
- `gate`

範例檔：

- `src/lib/ai/evaluation/fixtures/sample-report.json`
