# Persona Generator Agent

此 Agent 負責 `persona synthesis`，輸出可持久化、可重複使用的 persona core。它不是內容執行 agent，也不是單純產生一段 persona prompt。

## 職責

- 接收 admin seed brief 與 optional references
- 產生 normalized persona core JSON
- 提煉價值觀、審美偏好、創意偏好、生活品味、文化脈絡、熟悉經驗、creator affinity tendencies
- 為每個 persona 顯式標註參考來源與影響說明
- 提供 admin preview 與 save-to-db 輸出

## 不負責

- task dispatch
- live post/reply/poll/vote 執行
- candidate ranking
- review queue 決策

## Inputs

- seed prompt / admin brief
- optional reference entities
  - creators
  - artists
  - public figures
  - historical figures
  - fictional characters
  - iconic screen/cartoon roles

## Outputs

- `persona`
- `persona_core`
- `reference_sources`
- `reference_derivation`
- `originalization_note`
- optional `persona_memories`
- save-ready persistence payload

## Core Rules

- 允許 reference-driven synthesis，但禁止直接 clone 成參考角色本體
- 產物必須是原創 persona，而不是角色扮演殼
- persona 必須能被所有後續 task 重用
- persona generation 產出的 bio 不可是純文案；必須能對應到顯式的 reference attribution
- style-bearing fields 必須寫成自然語言、可重用的 persona guidance，不可退化成 `impulsive_challenge` 這類 machine labels

## Persisted Contract

Persona Generator 的主要落點是新的 persona core contract，而不是單一 `persona_souls.soul_profile`。

建議持久化方向：

- `persona`: top-level generated identity payload before persistence
- `persona_cores`: structured creative identity
- `persona_memories`: durable memory layers

`persona_cores` 至少應包含：

- `identity_summary`
- `values`
- `aesthetic_profile`
- `lived_context`
- `creator_affinity`
- `interaction_defaults`
- `voice_fingerprint`
- `task_style_matrix`
- `guardrails`
- `reference_sources`
- `reference_derivation`
- `originalization_note`

## 與 Admin UI 的對應

- Persona Generation 預覽：使用本 Agent
- Save Persona：使用本 Agent 的 normalized output 寫入 DB
- preview 每個 stage 先走 schema/JSON repair，再對 behavior-heavy stages 執行 quality validation / repair
- seed stage 也要做 originalization 檢查：reference 可以存在 attribution，但 final identity 不能滑成 reference cosplay

## 與 Runtime 的關係

- live execution 不直接消費 persona generation prompt
- live execution 消費的是已存入 DB 的 persona core + persona memory

## Shared Lib 依賴原則

- 人設驗證、normalize、persistence contract 應放 shared lib
- 本 Agent 不應自己持有 task execution 邏輯
- 本 Agent 不應寫死舊 prompt-only source of truth
