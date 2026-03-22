# Admin AI Control-Plane Module Map

> 狀態：反映 2026-03-22 之後的 refactored layout。`control-plane-store.ts` 現在是 facade，不應再回頭變成單檔萬用實作。

## 目的

這份文件說明 `src/lib/ai/admin/*` 內各模組的責任邊界，方便未來做：

- admin AI control-plane 功能延伸
- persona generation / interaction preview 調整
- AI agent 對 persona/admin 共用邏輯的複用

原則：

- contract / parser / shared formatter / service / store 要分層
- pure helper 優先放 shared 或 contract module
- DB I/O 留在 store facade
- selected-model preview / assist orchestration 留在 service module

## 模組分層

### 1. Contracts / Shared Types

- [control-plane-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-contract.ts)
  - admin AI control-plane 的 canonical types / errors
  - 例如 `PreviewResult`、`PersonaProfile`、`PromptAssistError`
  - 新功能若需要共用型別，優先加在這裡，不要再從 store re-export 當 source of truth

- [control-plane-types.tsx](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-types.tsx)
  - admin UI 專用展示型別與 section metadata
  - 像 `PersonaItem`、section icons、section items
  - 這是 UI layer helper，不放 runtime/service logic

### 2. Shared Pure Helpers

- [control-plane-shared.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-shared.ts)
  - admin control-plane 共用的 pure helper
  - 例如：
    - prompt block formatting
    - token budget estimation
    - policy document read/write
    - generic parse helpers like `readString`, `asRecord`
  - 如果 helper 同時被 store 與多個 service 用到，優先放這裡

- [control-plane-model-resolution.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-model-resolution.ts)
  - selected model / provider eligibility resolution
  - admin preview / assist flow 若需要 text model gate，統一走這裡

### 3. Persona Generation Parsing / Validation

- [persona-generation-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-contract.ts)
  - persona generation 專用 parser / validator / prompt-assist validation helper
  - 例如：
    - stage output parsing
    - `persona_core` canonical parsing
    - English-only / mixed-script quality checks
    - prompt-assist truncation / weak-output validation
  - 新的 staged generation schema 或 parser/quality logic 應先加在這裡

- [persona-generation-prompt-template.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-prompt-template.ts)
  - staged generation prompt/template preview 組裝
  - 主要用於 admin 的 View Prompt / preview explainability

- [persona-generation-token-budgets.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-token-budgets.ts)
  - persona generation / prompt-assist / admin preview 相關 budget constants
  - 調整 stage headroom、prompt-assist cap、semantic audit cap 時改這裡

### 4. Admin Preview / Assist Services

- [persona-generation-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-service.ts)
  - `Generate Persona` / `Update Persona` 共用 staged preview orchestration
  - 管：
    - selected-model invocation
    - stage loop
    - parse/repair
    - semantic audit / quality repair
    - preview payload assembly

- [persona-prompt-assist-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts)
  - `/api/admin/ai/persona-generation/prompt-assist`
  - 管：
    - reference-first assist
    - empty-output / truncation / missing-reference repair
    - typed prompt-assist errors

- [interaction-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/interaction-preview-service.ts)
  - `Interaction Preview` 單次 selected-model generation
  - 管：
    - prompt assembly
    - post/comment output parsing
    - persona audit / compact retry / repair
    - preview diagnostics

- [interaction-context-assist-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/interaction-context-assist-service.ts)
  - task context / scenario assist
  - 屬於 admin helper flow，不是 production runtime path

### 4.1 Batch Persona Helpers

- [persona-batch-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-contract.ts)
  - batch row / error / duplicate-check shared contract
  - 新的 batch UI state shape 與 reference check result 放這裡

- [persona-batch-queue.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-queue.ts)
  - chunked `Promise.allSettled` queue helper
  - bulk AI / generate / save 都應重用，不要各自重寫 batch loop

- [persona-save-payload.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-save-payload.ts)
  - single-persona flow 與 batch flow 共用的 create/update payload mapper
  - row identity (`displayName` / `username`) 覆蓋 canonical structured payload 的規則在這裡

- [persona-reference-normalization.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-reference-normalization.ts)
  - reference source 的 shared normalize / romanize / match-key helper
  - `persona-references/check`、persona save/update sync、以及 backfill script 都應重用這裡

### 5. Store Facade / Persistence

- [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts)
  - DB-backed facade
  - 主要責任：
    - providers / models CRUD
    - policy release CRUD
    - persona create / update / profile read
    - `persona_reference_sources` sync / rebuild
    - service 依賴組裝與 delegation
  - 不應再新增大段 parser / prompt assembly / audit orchestration 到這個檔案

### 5.1 One-Off Maintenance Script

- [backfill-persona-reference-sources.ts](/Users/neven/Documents/projects/llmbook/scripts/backfill-persona-reference-sources.ts)
  - 用既有 `persona_cores.reference_sources` 重建 `persona_reference_sources`
  - schema migration 不做 app-specific backfill 時，這支 script 是標準重建入口
  - npm alias: `npm run ai:persona-reference:backfill`

### 6. Mocks / Tests

- [persona-generation-preview-mock.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-mock.ts)
- [interaction-preview-mock.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/interaction-preview-mock.ts)
  - admin preview sandbox / UI review fixtures

- [PersonaBatchPreviewMockPage.tsx](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPreviewMockPage.tsx)
  - batch persona preview sandbox
  - 用 shared page shell + mock controller 驗證 table / modal / row actions

- [usePersonaBatchGeneration.ts](/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts)
  - batch row state / duplicate-check lifecycle / row & bulk orchestration
  - 若之後要新增 batch row rule，先改這裡，不要把 state machine 塞進 page component

- [ApiErrorDetailModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/ApiErrorDetailModal.tsx)
- [PersonaDataModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/PersonaDataModal.tsx)
- [TaskStatusBadge.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/TaskStatusBadge.tsx)
  - shared modal/status UI，不限定 admin
  - 之後若別的 agent flow 也要 debug API payload/raw response 或看 structured persona，優先重用這層

- `control-plane-store.*.test.ts`
  - store facade 與 service orchestration 的 focused regression tests

## 未來開發建議

### 若要加新的 persona-generation stage

1. 先改 [persona-generation-prompt-template.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-prompt-template.ts)
2. 再改 [persona-generation-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-contract.ts)
3. 再改 [persona-generation-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-service.ts)
4. 最後補 preview/store focused tests

### 若要改 prompt-assist contract

1. 先改 [persona-prompt-assist-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts)
2. 若涉及 validator，再改 [persona-generation-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-contract.ts)
3. 同步更新 [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)

### 若要加新的 admin preview/helper flow

- orchestration 新增 service file
- store 只做 thin wrapper
- shared parse/formatter 盡量放 [control-plane-shared.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-shared.ts)

### 若要改 persona batch flow

1. batch row/action state 先看 [usePersonaBatchGeneration.ts](/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts)
2. 若涉及 batch contract 或 save payload，改 [persona-batch-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-contract.ts) / [persona-save-payload.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-save-payload.ts)
3. 若涉及 shared UI，優先重用 [ApiErrorDetailModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/ApiErrorDetailModal.tsx) / [PersonaDataModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/PersonaDataModal.tsx)
4. duplicate check backend 改 [route.ts](/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-references/check/route.ts) + store facade

### 不要做的事

- 不要把新 parser/quality logic 直接塞回 [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts)
- 不要讓 UI 從 store 取得 canonical type source；優先用 [control-plane-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-contract.ts)
- 不要為 active-development contract 再加 legacy dual-read / dual-write fallback，除非使用者明確要求
