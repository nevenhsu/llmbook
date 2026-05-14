# Persona Batch Reference Names Support Plan

**Goal:** Bring `/admin/ai/persona-batch` to parity with `/admin/ai/control-plane` `Generate Persona` prompt-assist behavior so batch rows can capture `referenceNames` returned by `POST /api/admin/ai/persona-generation/prompt-assist`, expose them in the batch UI, and pass them into persona generation previews.

**Architecture:** Keep batch row source identity split into two layers: immutable `referenceName` for duplicate checking / row identity, and editable row-level `referenceNames` for prompt-assist output and generation input. Reuse the existing control-plane prompt-assist response contract instead of introducing a batch-only parsing path. Keep the page thin: row state remains in `usePersonaBatchGeneration`, shared row types live in `persona-batch-contract.ts`, and the table/modal components only render and edit that state.

**Tech Stack:** TypeScript, React hooks, Next.js admin routes, existing persona generation prompt-assist / preview APIs, Vitest.

---

## Scope And Constraints

- Scope is limited to `/admin/ai/persona-batch` and its preview sandbox.
- Reuse the existing `POST /api/admin/ai/persona-generation/prompt-assist` response shape `{ text, referenceNames, debugRecords }`.
- Match the current control-plane `Generate Persona` behavior:
  - assisted prompt text populates the prompt/context field directly from `res.text`
  - named references populate a dedicated `referenceNames` field
- Keep `referenceName` as the immutable batch seed and duplicate-check key. Returned / edited `referenceNames` are generation inputs, not a replacement for row identity.
- Keep reference names admin-side only. This plan does not change runtime persona packet rules or allow reference names to drift into normal runtime imitation instructions.
- Do not add a new batch-only API. The work should stay within the existing prompt-assist and preview endpoints plus local batch state.

## Current Gaps

- `usePersonaBatchGeneration.executeRowPromptAssist()` still types prompt-assist as `{ text }`, so batch drops the returned `referenceNames`.
- `PersonaBatchRow` has no row-level reference-names field, so the batch UI cannot preserve or edit named references independently from `contextPrompt`.
- `executeRowGenerate()` only sends `extraPrompt`, even though `previewPersonaGeneration()` already supports `referenceNames?: string`.
- The batch table has no column or summary for row-level reference names.
- The toolbar button still says `Add`, which is vague now that the page is explicitly reference-driven.

## Proposed State Contract

Add a dedicated row field that mirrors the control-plane card input shape:

```ts
type PersonaBatchRow = {
  rowId: string;
  referenceName: string; // immutable batch seed + duplicate-check key
  referenceNames: string; // editable comma-separated named references for preview input
  contextPrompt: string;
  // existing row fields unchanged...
};
```

Why a comma-separated string instead of `string[]` in row state:

- it matches the current `Generate Persona` card state shape (`referenceNames: string`)
- it can be passed directly to `previewPersonaGeneration({ referenceNames })`
- prompt-assist can still normalize its array response via `res.referenceNames.join(", ")`

Behavioral rules:

- On row creation from `Reference Sources`, seed `referenceNames` from the immutable `referenceName`.
- On prompt-assist success, update both:
  - `contextPrompt = res.text`
  - `referenceNames = res.referenceNames.join(", ")`
- Manual row edits to `referenceNames` should mark the row as stale for regenerate in the same way prompt edits currently do.

## Reuse From Control-Plane

Mirror the existing `/admin/ai/control-plane` `Generate Persona` path instead of cloning logic loosely:

- source contract:
  - [`src/app/api/admin/ai/persona-generation/prompt-assist/route.ts`](/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/prompt-assist/route.ts)
  - [`src/lib/ai/admin/persona-prompt-assist-service.ts`](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts)
- current client behavior:
  - [`src/hooks/admin/useAiControlPlane.ts`](/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts)
  - [`src/components/admin/control-plane/PersonaPromptCard.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaPromptCard.tsx)

Implementation note:

- The live control-plane hook no longer strips a trailing `Reference sources: ...` suffix; batch should mirror that direct `res.text` assignment rather than reintroducing suffix cleanup.

## Implementation Tasks

### Task 1: Extend Batch Row Contract And Hook State

**Files:**

- Modify: [`src/lib/ai/admin/persona-batch-contract.ts`](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-batch-contract.ts)
- Modify: [`src/hooks/admin/usePersonaBatchGeneration.ts`](/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.ts)
- Modify: [`src/hooks/admin/useAiControlPlane.ts`](/Users/neven/Documents/projects/llmbook/src/hooks/admin/useAiControlPlane.ts)

Changes:

- Add `referenceNames` to `PersonaBatchRow`.
- Seed `referenceNames` when new rows are created from the add-reference modal.
- Change batch prompt-assist typing from `{ text: string }` to `{ text: string; referenceNames: string[]; debugRecords: StageDebugRecord[] }`.
- On prompt success, persist both `contextPrompt` and row `referenceNames`.
- Update `executeRowGenerate()` to call `/api/admin/ai/persona-generation/preview` with:

```ts
{
  modelId,
  extraPrompt: row.contextPrompt,
  referenceNames: row.referenceNames,
}
```

- Treat manual `referenceNames` edits as generation-input changes so regenerate is still required after edits.

### Task 2: Update Batch Editing Surfaces

**Files:**

- Modify: [`src/components/admin/persona-batch/PersonaBatchPage.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPage.tsx)
- Modify: [`src/components/admin/persona-batch/EditContextPromptModal.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/EditContextPromptModal.tsx)
- Modify: [`src/components/admin/persona-batch/PersonaBatchRow.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchRow.tsx)
- Modify: [`src/components/admin/persona-batch/PersonaBatchTable.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchTable.tsx)

Changes:

- Extend the existing edit-context modal so it edits both:
  - `Reference Names`
  - `Context Prompt`
- Keep one modal instead of adding a second row editor. This preserves the current compact table layout while still giving each row a control-plane-like two-field input surface.
- Add a `Reference Names` table column with a truncated joined summary and row-level affordances that stay consistent with the current table style.
- Keep the immutable seed `referenceName` column separate so operators can still distinguish:
  - the original reference used to create/check the row
  - the current generation-time named references returned by prompt assist

Recommended table shape:

1. `Reference Name` (immutable seed + duplicate/new badge)
2. `Reference Names` (editable generation references)
3. `Context Prompt`
4. `Persona`
5. `Task`
6. `Actions`

### Task 3: Rename The Toolbar Action For Clarity

**Files:**

- Modify: [`src/components/admin/persona-batch/PersonaBatchToolbar.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchToolbar.tsx)
- Modify: [`src/components/admin/persona-batch/ReferenceSourcesModal.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/ReferenceSourcesModal.tsx)

Changes:

- Rename the toolbar button from `Add` to `Add Reference`.
- Keep `Reference Sources` as the section label unless a broader copy cleanup is requested later.
- Leave modal submit copy alone unless implementation finds the dual `Add` labels confusing in tests; if so, align both button labels in one pass rather than mixing terminology.

### Task 4: Refresh Preview Mocks And Focused Tests

**Files:**

- Modify: [`src/hooks/admin/usePersonaBatchGeneration.test.ts`](/Users/neven/Documents/projects/llmbook/src/hooks/admin/usePersonaBatchGeneration.test.ts)
- Modify: [`src/components/admin/persona-batch/PersonaBatchToolbar.test.ts`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchToolbar.test.ts)
- Modify: [`src/components/admin/persona-batch/PersonaBatchTable.test.ts`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchTable.test.ts)
- Modify: [`src/components/admin/persona-batch/EditContextPromptModal.test.ts`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/EditContextPromptModal.test.ts)
- Modify: [`src/components/admin/persona-batch/PersonaBatchPreviewMockPage.tsx`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPreviewMockPage.tsx)
- Modify: [`src/components/admin/persona-batch/PersonaBatchPreviewMockPage.test.ts`](/Users/neven/Documents/projects/llmbook/src/components/admin/persona-batch/PersonaBatchPreviewMockPage.test.ts)

Coverage targets:

- new rows seed `referenceNames` from the added source reference
- prompt assist stores both `contextPrompt` and returned `referenceNames`
- generate preview receives `referenceNames` in its payload
- row editing updates `referenceNames` and triggers the same stale/regenerate reminder path as prompt edits
- table renders the new `Reference Names` column
- toolbar uses `Add Reference`
- preview sandbox fixtures include row `referenceNames` so the mock page stays faithful to the real contract

## Verification

Focused verification should stay at the batch surface:

```bash
npx vitest run \
  src/hooks/admin/usePersonaBatchGeneration.test.ts \
  src/components/admin/persona-batch/PersonaBatchToolbar.test.ts \
  src/components/admin/persona-batch/PersonaBatchTable.test.ts \
  src/components/admin/persona-batch/EditContextPromptModal.test.ts \
  src/components/admin/persona-batch/PersonaBatchPreviewMockPage.test.ts
```

Additional consistency check:

```bash
git diff --check
```

## Full Related File List

```text
src/lib/ai/admin/persona-batch-contract.ts
src/lib/ai/admin/control-plane-shared.ts
src/hooks/admin/useAiControlPlane.ts
src/hooks/admin/usePersonaBatchGeneration.ts
src/hooks/admin/usePersonaBatchGeneration.test.ts
src/components/admin/persona-batch/PersonaBatchPage.tsx
src/components/admin/persona-batch/PersonaBatchToolbar.tsx
src/components/admin/persona-batch/PersonaBatchToolbar.test.ts
src/components/admin/persona-batch/ReferenceSourcesModal.tsx
src/components/admin/persona-batch/EditContextPromptModal.tsx
src/components/admin/persona-batch/EditContextPromptModal.test.ts
src/components/admin/persona-batch/PersonaBatchRow.tsx
src/components/admin/persona-batch/PersonaBatchTable.tsx
src/components/admin/persona-batch/PersonaBatchTable.test.ts
src/components/admin/persona-batch/PersonaBatchPreviewMockPage.tsx
src/components/admin/persona-batch/PersonaBatchPreviewMockPage.test.ts
src/components/admin/control-plane/PersonaPromptCard.tsx
src/app/api/admin/ai/persona-generation/prompt-assist/route.ts
src/lib/ai/admin/persona-prompt-assist-service.ts
```

## Expected Outcome

After this work:

- prompt assist on batch rows behaves like the control-plane `Generate Persona` card
- operators can see and edit row-level named references explicitly
- batch generate requests stop discarding the separated reference-name input
- the page copy makes the reference-driven workflow more obvious
