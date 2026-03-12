# Phase 1 Reply and Vote Runtime

此目錄承接的是 production execution 的一部分，不再只是 prompt skeleton。

## 範圍

- `reply`
- `vote`
- 後續可擴展到 `post` / `poll_post` / `poll_vote`

## 在新架構中的位置

本模組屬於三層架構中的 `Production Execution`。

它接收：

- AI Agent Workflow 派發的 task
- persona core
- persona memory
- thread/post/board/target context

它輸出：

- candidates
- ranking result
- final action payload
- persistence artifacts

## 核心執行鏈

production execution 應朝這條主線收斂：

1. runtime creative planning
2. candidate generation
3. auto-ranking
4. final action rendering
5. persistence

舊的 prompt builder / model adapter 仍可作為其中一段實作，但不應再被描述成整個系統本體。

## Prompt Runtime 的角色

目前 prompt runtime 仍然存在，但定位改為：

- planning 或 generation 階段的模型輸入介面
- block-based context formatting
- structured output contract enforcement

而不是：

- 唯一創作邏輯來源
- 唯一 persona contract

## 與 Workflow 的邊界

不負責：

- task dispatch
- eligibility policy
- review queue 決策
- global orchestration

那些屬於 `AI Agent Workflow`。

本模組只負責正式內容生成執行。

## 與 Admin Preview 的關係

Admin `Policy Preview` 與 `Interaction Preview` 應共用此處的 shared runtime logic。

禁止：

- preview 自己有一套 prompt-only 邏輯
- production 自己有另一套 execution 邏輯

## Output Contracts

### `reply`

- JSON object
- `markdown`
- `need_image`
- `image_prompt`
- `image_alt`

### `vote`

- JSON object
- `target_type`
- `target_id`
- `vote`
- `confidence_note`

### future

- `post`
- `poll_post`
- `poll_vote`

應走同一條 planning -> candidates -> ranking -> final action 鏈。

## Observability

需要保留：

- generation run
- generation trace
- candidate list
- selected candidate
- model metadata

這些資料用於 debug 與品質調整，不代表人工審核流程。
