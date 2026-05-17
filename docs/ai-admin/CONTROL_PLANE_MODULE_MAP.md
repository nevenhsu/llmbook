# Admin AI Control-Plane Module Map

> Status: reflects the current layout after the registered post/comment/reply flow-module migration and the simplified admin preview surface. `control-plane-store.ts` is a facade, `AiAgentPersonaInteractionService` is the no-write interaction adapter, text-flow logic lives under `src/lib/ai/agent/execution/flows/*`, and runtime writes live outside `src/lib/ai/admin/*`.
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
  - 例如 `PreviewResult`、`PersonaProfile`、`PersonaGenerationParseError`
  - 新功能若需要共用型別，優先加在這裡，不要再從 store re-export 當 source of truth

- [stage-debug-records.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/stage-debug-records.ts)
  - shared staged-LLM debug payload types
  - `StageDebugRecord` / `StageDebugAttemptRecord` 供 runtime flow modules、admin preview services、and shared debug UI 共用
  - 不限定 persona generation，interaction flow 也 emit 相同 shape

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
  - persona generation 專用 parser / validator
  - 例如：
    - stage output parsing
    - `reference_sources` / `other_reference_sources` canonical parsing
    - `persona_core` canonical parsing
    - English-only / mixed-script quality checks
  - 新的 staged generation schema 或 parser/quality logic 應先加在這裡

- [generation-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts)
  - canonical generate-persona prompt assembly (moved to `src/lib/ai/prompt-runtime/persona/`)
  - shared builder consumed by both runtime invocation and admin prompt preview
  - replaces the retired admin-only `persona-generation-prompt-template.ts`

- [persona-generation-token-budgets.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-token-budgets.ts)
  - persona generation / prompt-assist / admin preview 相關 budget constants
  - 調整 main/preview output headroom 與 prompt-assist cap 時改這裡

### 4. Admin Preview / Assist Services

- [persona-generation-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-service.ts)
  - `Generate Persona` / `Update Persona` 共用 one-stage preview orchestration
  - 管：
    - selected-model invocation
    - shared prompt-runtime builder consumption
    - schema-gate invocation
    - parse/deterministic quality checks
    - preview payload assembly

- [prompt-assist-schema.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/prompt-assist-schema.ts)
  - PromptAssist 的 narrow Zod schema
  - LLM-owned output shape: `{ text, referenceNames }`
  - schema ownership only; debugRecords 屬於 API/code envelope

- [prompt-assist-prompt.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts)
  - PromptAssist 的 canonical prompt text
  - single render helper for the one structured call
  - 不要將 prompt 放回 `src/lib/ai/admin/*`

- [persona-prompt-assist-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts)
  - `/api/admin/ai/persona-generation/prompt-assist`
  - one `invokeStructuredLLM` call with the PromptAssist schema
  - app-code normalization and deterministic checks (text not empty, referenceNames not empty)
  - returns `{ text, referenceNames, debugRecords }` on success or `{ error, rawText, debugRecords }` on failure

- [interaction-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/interaction-preview-service.ts)
  - `Interaction Preview` 的 admin no-write wrapper
  - 管：
    - `previewPersonaInteraction()` no-write wrapper
    - `debug: true` handoff so admin review can inspect stage prompt/attempt records
  - 不承擔 prompt assembly / audit / repair core；那層已移到 runtime/execution flow modules

- [persona-interaction-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/persona-interaction-service.ts)
  - admin/runtime interaction adapter
  - 管：
    - `AiAgentPersonaInteractionService.run()`
    - `runPersonaInteraction()` compatibility export
    - user-facing `post` / `comment` / `reply` dispatch to registered text-flow modules
    - persisted persona profile loading for preview
    - selected model/provider handoff
    - final markdown render validation
  - 不要在這裡新增每個 flow 的 parser / audit / repair 分支；那層歸 `flows/*` ownership

- [flows/registry.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/flows/registry.ts)
- [flows/types.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/flows/types.ts)
- [post-flow-module.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/flows/post-flow-module.ts)
- [comment-flow-module.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/flows/comment-flow-module.ts)
- [reply-flow-module.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/agent/execution/flows/reply-flow-module.ts)
  - shared text-flow modules for `post` / `comment` / `reply`
  - 管：
    - stage sequencing
    - candidate selection (post only)
    - frame/body parsing
    - failure classification
    - flow diagnostics and debug record collection
    - direct one-stage orchestration for `comment_body` / `reply_body` (the retired `single-stage-writer-flow.ts` shape no longer owns these flows)
  - post-stage prompt-visible text is **not** owned here — it lives in `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`
  - admin preview、runtime、jobs-runtime、tests 若要重用 post/comment/reply LLM flow，應走 registry/module，不要各自再做 prompt/audit 分支

- [post-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/post/post-prompt-builder.ts)
  - canonical post-stage prompt-text owner for `post_plan`, `post_frame`, and `post_body`
  - owns: stage instruction text (`action_mode_policy`, `content_mode_policy`), stage `taskContext`, and prompt-visible handoff rendering (`[selected_post_plan]`, `[post_frame]` target-context blocks)
  - consumed by both `buildPersonaPromptFamilyV2()` (via delegation) and `post-flow-module.ts` (via import)
  - when editing post-stage prompt wording, start here, not in `post-flow-module.ts`

- [comment-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/comment/comment-prompt-builder.ts)
- [reply-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/reply/reply-prompt-builder.ts)
  - canonical comment/reply prompt-text owners
  - own flow-local block order helpers, prompt-visible `taskContext`, prompt-visible `target_context` rendering, and the delegated block content consumed by `buildPersonaPromptFamilyV2()`
  - when editing top-level comment or thread-reply prompt wording, start here rather than in `persona-v2-prompt-family.ts` or the flow modules

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

- [generation-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts)
  - canonical generate-persona prompt assembly
  - shared between runtime invocation (`persona-generation-preview-service.ts`) and admin prompt preview (`PersonaGenerationSection.tsx` / `PromptAssemblyModal.tsx`)
  - admin preview is a consumer, not the owner of a separate prompt-template path

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
  - admin persona-generation preview sandbox / UI review fixture

- Interaction preview mock pages/fixtures were removed.
  - Active admin manual interaction preview now runs through `AiAgentPersonaInteractionService`.
  - Prompt/debug inspection should come from `StageDebugCard` + `stageDebugRecords`, not a fixture-backed `assembledPrompt` response field.

- [PersonaBatchPreviewMockPage.tsx](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPreviewMockPage.tsx)
  - batch persona preview sandbox
  - 用 shared page shell + mock controller 驗證 table / modal / row actions

- [usePersonaBatchGeneration.ts](/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts)
  - batch row state / duplicate-check lifecycle / row & bulk orchestration
  - 若之後要新增 batch row rule，先改這裡，不要把 state machine 塞進 page component

- [ApiErrorDetailModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/ApiErrorDetailModal.tsx)
- [PersonaDataModal.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/PersonaDataModal.tsx)
- [TaskStatusBadge.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/TaskStatusBadge.tsx)
- [StageDebugCard.tsx](/Users/neven/Documents/projects/llmbook/src/components/shared/StageDebugCard.tsx)
  - shared modal/status UI，不限定 admin
  - 之後若別的 agent flow 也要 debug API payload/raw response 或看 structured persona，優先重用這層
  - `StageDebugCard` 是 generic staged-LLM debug card，供 persona generation preview 與 interaction preview 共用
  - type payload 來自 [stage-debug-records.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/stage-debug-records.ts) 的 `StageDebugRecord` / `StageDebugAttemptRecord`
  - 不要再新增第二個 flow-specific debug card

- `control-plane-store.*.test.ts`
  - store facade 與 service orchestration 的 focused regression tests

## 未來開發建議

### 若要改 persona generation prompt

1. 先改 [generation-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts) — prompt-runtime canonical builder
2. 再改 [persona-generation-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-contract.ts) — parser/quality logic
3. admin preview/UI 會自動反映 shared builder 的變更，不需要手動同步
4. 最後補 preview/store focused tests

### 若要改 prompt-assist contract

1. 先改 [prompt-assist-prompt.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona/prompt-assist-prompt.ts) — canonical prompt text
2. 若涉及 schema，再改 [prompt-assist-schema.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/prompt-assist-schema.ts)
3. 再改 [persona-prompt-assist-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts) — service orchestration
4. 同步更新 [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)

### 若要改 post-stage prompt wording

1. 先改 [post-prompt-builder.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/post/post-prompt-builder.ts) — canonical post prompt-text owner
2. `buildPersonaPromptFamilyV2()` and `post-flow-module.ts` consume it automatically; no manual sync needed
3. 更新 [post-prompt-builder.test.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts) — focused post-stage tests
4. 不要直接改 `post-flow-module.ts` 的 prompt wording — 那個檔案現在只做 orchestration

### 若要加新的 admin preview/helper flow

- 若是 text interaction flow，先新增/擴充 `flows/*` module 並註冊到 registry
- admin-facing orchestration 新增 service file only when a route/UI wrapper is needed
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
