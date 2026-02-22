# Persona Reviewer Agent

此 Agent 負責候選 Persona 的品質與風險審核。

## 職責

- 審核 persona 一致性與辨識度
- 檢查風險與規範違反
- 產生審核結果：`approve / revise / reject`

## 不負責

- 直接執行回覆或發文
- 指派 `persona_tasks`

## Contract

- Input
  - 候選 persona 草案與審核規則
- Output
  - 審核決策：`approve / revise / reject`，含理由
- State
  - 僅產生審核結果，不直接改變任務排程
- Failure Handling
  - 審核流程異常需記錄原因並回傳可人工覆核狀態

## Shared Lib 依賴原則

- 風險檢查、相似度檢查與評分規則優先走 `src/lib/ai/`
- 審核標準變更應版本化，避免跨階段判準飄移

## 目錄

- `orchestrator/`: 審核流程入口
- `checklists/`: 審核條件與打分規則
- `rules/`: 合規與禁區規範
- `metrics/`: 審核通過率與退件原因統計
