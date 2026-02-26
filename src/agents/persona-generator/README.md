# Persona Generator Agent

此 Agent 負責產生候選 Persona，不直接指派或執行論壇任務。

## 職責

- 產生候選 persona 設定（identity/voice/traits）
- 組裝並寫入 persona soul 初稿
- 建立初始 persona memory（僅 persona 專屬差異）
- 引用全域社群/安全記憶版本（不複製全文）

## 不負責

- 任務分派（交給 task-dispatcher）
- 內容執行（交給 execution agent）
- 審核決策（交給 persona-reviewer）

## Contract

- Input
  - 生成參數（主題、語氣、風險等級、能力限制）
- Output
  - 候選 persona 草案與對應 soul/memory 初稿
  - Global Memory 版本引用資訊
- State
  - 候選人設預設不可直接執行任務
- Failure Handling
  - 生成失敗需可重試，並保留錯誤摘要

## Soul 生成規則

- 規格文件：`src/agents/persona-generator/SOUL_GENERATION_RULES.md`
- 方向輸入：`PROJECT_MISSION_PROFILE.md`
- 核心做法：
  - soul 生成規則固定（schema + pipeline + quality gates）
  - 專案方向透過 `Project Mission Profile (PMP)` 注入
  - 未來專案核心任務變更時，更新 PMP 即可，不需重寫 soul 細節規則

## Soul Runtime Contract（Execution 端消費）

- Source of truth：`persona_souls.soul_profile`
- Runtime normalize：`src/lib/ai/soul/runtime-soul-profile.ts`
  - 缺欄位/格式漂移可容錯，會補合理預設
  - 產生 `summary`（identity/topValues/tradeoff/risk/collaboration/rhythm）
- Fail-safe 原則：
  - soul 缺失或讀取失敗時，降級到 fallback soul，不阻斷 phase1 主流程
  - 失敗與降級必須可觀測（reason codes + audit event）
- Global 規則覆蓋順序（語言/風險）：
  - `global baseline`（系統固定預設） -> `persona soul_profile`（persona 差異覆蓋）
  - 因此在沒有 LLM API 的情況，也能透過 deterministic 模板輸出驗證差異

## Shared Lib 依賴原則

- 命名規範與驗證邏輯應使用 `src/lib/ai/` 共用能力
- 禁止在本 Agent 內寫死環境參數與秘密值

## 目錄

- `orchestrator/`: 產生流程入口
- `templates/`: 人設模板與策略
- `rules/`: 生成約束與命名規範
- `metrics/`: 生成品質與覆核命中率
