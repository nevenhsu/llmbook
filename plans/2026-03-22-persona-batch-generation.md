# Persona Batch Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new admin page for batch persona generation that reuses the existing prompt-assist, persona-preview, and persona-save APIs while supporting duplicate-reference checks, row-level editing, row/bulk actions, timers, and debuggable API error inspection.

**Architecture:** Build a dedicated `/admin/ai/persona-batch` page with a client-side work queue. Keep backend reuse high by calling the existing prompt-assist, preview, and persona create routes directly, and add only one new backend route for bulk reference-name existence checks. Extract shared UI for API error inspection and persona-data viewing so the new page does not fork admin-only modal behavior.

**Tech Stack:** Next.js App Router, React client components/hooks, existing admin AI store/routes, Vitest, shared username normalization.

---

### Task 1: Define shared batch contracts and save-payload mapping

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-contract.ts`
- Create: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-save-payload.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-save-payload.test.ts`

**Steps:**

1. Write a failing test for converting generated persona data plus row identity into the save payload expected by `POST /api/admin/ai/personas`.
2. Define canonical batch-row types:
   - `referenceName`
   - `contextPrompt`
   - `displayName`
   - `username`
   - `personaData`
   - `saved`
   - `referenceCheckStatus`
   - `latestError`
   - `activeTask`
   - `activeElapsedSeconds`
3. Extract a shared mapper from existing single-persona save logic so both the current control-plane flow and the new batch page can build the same canonical payload.
4. Update the existing single-persona save path to use the shared mapper without changing behavior.

**Verification:**

- `npx vitest run src/lib/ai/admin/persona-save-payload.test.ts`

### Task 2: Add bulk reference existence check support

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-references/check/route.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-references/check/route.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-reference-check.test.ts`

**Steps:**

1. Write a failing store test for checking a batch of reference names against stored `reference_sources`.
2. Add a store facade method that accepts `string[]` and returns normalized existence results using:
   - trimmed names
   - case-insensitive exact match
3. Write a failing route test for `POST /api/admin/ai/persona-references/check`.
4. Add the route that validates `names: string[]`, limits request size, calls the store, and returns normalized results.

**Verification:**

- `npx vitest run src/lib/ai/admin/control-plane-store.persona-reference-check.test.ts src/app/api/admin/ai/persona-references/check/route.test.ts`

### Task 3: Extract shared non-admin-limited modals for persona viewing and API error debugging

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/components/shared/ApiErrorDetailModal.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/shared/PersonaDataModal.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/shared/TaskStatusBadge.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaGenerationModal.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/shared/ApiErrorDetailModal.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/shared/PersonaDataModal.test.ts`

**Steps:**

1. Write failing tests for:
   - error modal rendering title, JSON copy action, and payload/response sections
   - persona modal rendering structured persona data and disabled action buttons when no persona data exists
2. Extract a shared error detail modal that copies one JSON string containing:
   - `errorMessage`
   - `apiUrl`
   - `payload`
   - `rawResponse`
3. Extract a shared persona-data modal that can show generated persona data and optional footer actions like `Regenerate` and `Save`.
4. Extract a small shared badge component for row-level task state and elapsed-time display.
5. Reuse the extracted surfaces from the existing admin persona modal where practical, instead of duplicating structured persona rendering.

**Verification:**

- `npx vitest run src/components/shared/ApiErrorDetailModal.test.ts src/components/shared/PersonaDataModal.test.ts`

### Task 4: Add batch queue and row-action orchestration hooks

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts`
- Create: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-queue.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-queue.test.ts`

**Steps:**

1. Write failing tests for row-level and bulk execution rules:
   - bulk disabled while any row task is running
   - row actions disabled while any bulk task is running
   - other rows may still run individually when one row is active
   - reset disabled while any API is in flight
2. Implement a queue helper that:
   - accepts a chunk size from `1..20`
   - runs one batch with `Promise.allSettled`
   - advances to the next batch only after the current chunk settles
3. Implement the page hook to manage:
   - row state
   - row timers
   - bulk timers
   - reference check lifecycle
   - action eligibility and skip rules
4. Keep row identity (`displayName`, `username`) as the source of truth for save operations even when `personaData` exists.

**Verification:**

- `npx vitest run src/lib/ai/admin/persona-batch-queue.test.ts src/hooks/admin/usePersonaBatchGeneration.test.ts`

### Task 5: Build the batch page shell and input workflow

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/app/admin/ai/persona-batch/page.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPage.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchToolbar.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/ChunkSizeModal.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPage.test.ts`

**Steps:**

1. Write a failing page test that covers:
   - model selection shown first
   - input supports comma and newline separated reference names
   - add operation creates rows and dedupes within the same input set
   - reset button is disabled during active work
2. Build the new page under `/admin/ai/persona-batch`.
3. Add the toolbar with:
   - model selection
   - reference input + add
   - chunk size button/modal
   - reset button
4. Ensure added rows start as:
   - `Unchecked`
   - no `personaData`
   - no `saved`
   - no active error

**Verification:**

- `npx vitest run src/components/admin/persona-batch/PersonaBatchPage.test.ts`

### Task 6: Build the batch table and row cells

**Files:**

- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchTable.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchRow.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/EditContextPromptModal.tsx`
- Create: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/EditPersonaIdentityModal.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchTable.test.ts`

**Steps:**

1. Write failing table tests for:
   - `Reference Name` column showing `Unchecked`, `Checking`, `New`, `Duplicate`
   - `Context Prompt` cell showing summary snippet and edit modal trigger
   - `Persona` cell showing `display_name` and `username`
   - `Time` cell showing badge + elapsed
   - `Error` cell showing latest error type + view modal trigger
2. Add row-level actions:
   - `AI`
   - `Generate` or `Regenerate`
   - `Save` or `Saved`
   - `Clear`
3. Add edit modals:
   - `Edit Context Prompt`
   - `Edit Persona Identity`
4. Add `View Persona` within the Persona cell to open the shared persona modal.

**Verification:**

- `npx vitest run src/components/admin/persona-batch/PersonaBatchTable.test.ts`

### Task 7: Implement row-level API behavior and state transitions

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.test.ts`

**Steps:**

1. Write failing tests for row behaviors:
   - `AI` disabled unless reference check passed as `New`
   - `Generate` disabled unless reference check passed and `contextPrompt` is non-empty
   - `Regenerate` appears when `personaData` exists and forces `saved=false`
   - `Edit Persona Identity` keeps persona data but sets `saved=false`
   - `Edit Context Prompt` keeps persona data and saved state, but marks prompt as changed so the row clearly needs a regenerate to synchronize
2. Implement row-level prompt assist by calling the existing prompt-assist route.
3. Implement row-level generate/regenerate by calling the existing persona preview route and mapping preview output into row `personaData`, `displayName`, and `username`.
4. Implement row-level save by calling the existing create persona route with the shared save mapper.
5. Clear only the matching row/action error when that action later succeeds.

**Verification:**

- `npx vitest run src/hooks/admin/usePersonaBatchGeneration.test.ts`

### Task 8: Implement bulk actions with chunked execution and live row updates

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchToolbar.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPage.test.ts`

**Steps:**

1. Write failing tests for bulk behavior:
   - bulk `AI` only processes rows with empty `contextPrompt`
   - bulk `Generate` only processes rows with non-empty `contextPrompt` and empty `personaData`
   - bulk `Save` skips rows with no `personaData` or already `saved`
   - bulk actions process rows in chunks and expose row-level loading/timers as they run
2. Implement bulk `AI`, `Generate`, and `Save` actions on top of the queue helper.
3. Disable all bulk buttons while any bulk task is active.
4. Disable bulk buttons when any row-level action is active.
5. Keep row-level loading and elapsed status visible while bulk work is progressing.

**Verification:**

- `npx vitest run src/hooks/admin/usePersonaBatchGeneration.test.ts src/components/admin/persona-batch/PersonaBatchPage.test.ts`

### Task 9: Add duplicate-reference checks and table-internal duplicate logic

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.test.ts`

**Steps:**

1. Write failing tests for:
   - duplicate vs new status from DB
   - duplicate status caused only by table-internal repeated reference names
   - check errors surfacing only in the Error cell
2. Run a bulk reference check automatically after rows are added.
3. Recompute duplicate status when rows are removed via `Clear`.
4. Block `AI`, `Generate`, `Regenerate`, and `Save` for duplicate rows.

**Verification:**

- `npx vitest run src/hooks/admin/usePersonaBatchGeneration.test.ts`

### Task 10: Document the batch page and its reuse boundaries

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Steps:**

1. Document the new page, new duplicate-check API, and the fact that it reuses existing prompt-assist/preview/save routes.
2. Record where the shared debug modal, persona modal, and batch orchestration hook live.
3. Record the row-state rules that matter for future maintenance:
   - row identity is the save source of truth
   - reference names are immutable once added; users must `Clear` and re-add
   - duplicate rows cannot run AI/generate/save

**Verification:**

- `git diff --check -- docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md tasks/todo.md tasks/lessons.md`

### Final Verification

**Run:**

- `npx vitest run src/lib/ai/admin/persona-save-payload.test.ts src/lib/ai/admin/control-plane-store.persona-reference-check.test.ts src/app/api/admin/ai/persona-references/check/route.test.ts src/components/shared/ApiErrorDetailModal.test.ts src/components/shared/PersonaDataModal.test.ts src/lib/ai/admin/persona-batch-queue.test.ts src/hooks/admin/usePersonaBatchGeneration.test.ts src/components/admin/persona-batch/PersonaBatchPage.test.ts src/components/admin/persona-batch/PersonaBatchTable.test.ts`
- `npx tsc --noEmit --pretty false 2>&1 | rg 'src/app/admin/ai/persona-batch|src/components/admin/persona-batch|src/components/shared/ApiErrorDetailModal|src/components/shared/PersonaDataModal|src/hooks/admin/usePersonaBatchGeneration|src/lib/ai/admin/persona-batch|src/app/api/admin/ai/persona-references/check'`
- `git diff --check -- /Users/neven/Documents/projects/llmbook`

**Expected:**

- New batch page tests pass.
- New duplicate-check route/store tests pass.
- Shared modal tests pass.
- Filtered TypeScript check prints no matching errors.
- `git diff --check` is clean.
