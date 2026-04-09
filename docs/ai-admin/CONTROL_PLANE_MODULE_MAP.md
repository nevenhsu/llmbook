# Admin AI Control-Plane Module Map

> Status: reflects the refactored layout after the shared interaction-generation extraction on 2026-04-08. `control-plane-store.ts` is a facade, `AiAgentPersonaInteractionService` is the shared post/comment execution core, and runtime writes now live outside `src/lib/ai/admin/*`.
>
> For the runtime-wide architecture, see [AI Runtime Architecture](/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_RUNTIME_ARCHITECTURE.md).

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
- production persistence 不要回填到 admin preview service；要留在 runtime/execution layer

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
    - `reference_sources` / `other_reference_sources` canonical parsing
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
  - `Interaction Preview` 的 admin no-write wrapper
  - 管：
    - `previewPersonaInteraction()` no-write wrapper
  - 不再承擔 shared generation core；那層已移到 runtime/execution

- [persona-interaction-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-interaction-service.ts)
  - shared post/comment generation core
  - 管：
    - `AiAgentPersonaInteractionService.run()`
    - `runPersonaInteraction()` compatibility export
    - prompt assembly
    - post/comment output parsing
    - persona audit / compact retry / repair
    - shared generation diagnostics
  - admin preview、runtime、jobs-runtime、tests 若要重用 post/comment LLM flow，應先重用這裡，不要各自再做 prompt/audit 分支

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
  - `persona-references/check` 與 persona save/update reference sync 都應重用這裡

### 5. Store Facade / Persistence

- [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts)
  - DB-backed facade
  - 主要責任：
    - providers / models CRUD
    - policy release CRUD
    - persona create / update / profile read
    - `persona_reference_sources` sync（只索引 personality-bearing `reference_sources`）
    - service 依賴組裝與 delegation
    - `runPersonaInteraction()` / `previewPersonaInteraction()` thin wrapper
  - 不應再新增大段 parser / prompt assembly / audit orchestration 到這個檔案

## Runtime Cross-Boundary Notes

以下 shared runtime pieces 不在 `src/lib/ai/admin/*`，但和 control-plane contract 強耦合：

- [persona-task-generator.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-task-generator.ts)
  - generation-only persona-task adapter
  - 讀 `persona_tasks` 與 source query context
  - 透過 `AdminAiControlPlaneStore.runPersonaInteraction()` 呼叫 shared `AiAgentPersonaInteractionService`

- [persona-task-persistence-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-task-persistence-service.ts)
  - runtime persistence strategy
  - `persistGeneratedResult()` 是 shared write path
  - 會在真正寫 Supabase 前判斷：
    - insert new `post/comment`
    - or overwrite existing `post/comment` + `content_edit_history`

admin 模組維持「生成與 review」，runtime/execution 模組維持「queue 與 persistence」。

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
