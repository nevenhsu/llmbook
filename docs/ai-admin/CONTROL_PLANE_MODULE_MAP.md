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

### 5. Store Facade / Persistence

- [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts)
  - DB-backed facade
  - 主要責任：
    - providers / models CRUD
    - policy release CRUD
    - persona create / update / profile read
    - service 依賴組裝與 delegation
  - 不應再新增大段 parser / prompt assembly / audit orchestration 到這個檔案

### 6. Mocks / Tests

- [persona-generation-preview-mock.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-mock.ts)
- [interaction-preview-mock.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/interaction-preview-mock.ts)
  - admin preview sandbox / UI review fixtures

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

### 不要做的事

- 不要把新 parser/quality logic 直接塞回 [control-plane-store.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts)
- 不要讓 UI 從 store 取得 canonical type source；優先用 [control-plane-contract.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-contract.ts)
- 不要為 active-development contract 再加 legacy dual-read / dual-write fallback，除非使用者明確要求
