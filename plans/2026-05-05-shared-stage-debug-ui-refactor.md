# Shared Stage Debug UI Refactor Plan

> **For Codex:** Before implementation, use `superpowers:executing-plans` or follow this plan task-by-task with focused verification after each task.

**Goal:** Move the reused stage-debug UI out of the admin control-plane folder and rename it as a generic shared component.

**Architecture:** Treat `stageDebugRecords` as a generic staged-LLM debug payload, not a persona-generation-only concept. Keep the UI refactor mechanical and narrow: create one shared type module, one shared component, update existing control-plane consumers, and update stale tests to match the simplified preview UI from commit `bb6f372a3986032b36223b2de26d5e5e6652fa6c`. Do not reintroduce `Prompt Assembly`, `Audit Diagnostics`, or `Flow Diagnostics`; those sections were intentionally removed for simplification.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest/jsdom, DaisyUI utility classes, lucide-react icons.

---

## Recent Development Context

- Commit `bb6f372a3986032b36223b2de26d5e5e6652fa6c` simplified post planning, consolidated runtime scoring, and simplified the admin preview UI.
- `src/components/admin/control-plane/PersonaGenerationDebugCard.tsx` is now reused by both:
  - `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
  - `src/components/admin/control-plane/InteractionPreviewModal.tsx`
- The component and its backing type are still named `PersonaGeneration...`, even though the payload now covers post/comment/reply flow stages.
- Existing focused UI tests still assert removed preview sections:
  - `Prompt Assembly`
  - `Audit Diagnostics`
  - `Flow Diagnostics`

Interpretation: extract the reused prompt/attempt debug card as shared stage-debug UI, and update tests so they verify the simplified preview surface instead of restoring intentionally removed sections.

---

## Desired End State

- Shared type module:
  - `src/lib/ai/stage-debug-records.ts`
  - Exports `StageDebugRecord` and `StageDebugAttemptRecord`.
- Shared UI component:
  - `src/components/shared/StageDebugCard.tsx`
  - Exported component name: `StageDebugCard`.
  - Props stay structurally equivalent to the current debug card: `records`, `errorMessage`, `errorDetails`, and `rawOutput`.
  - UI labels stay generic: `Stage Debug`, `Error Debug`, `Raw LLM Output`, `Prompt`, `Responses`.
- Removed admin-local component:
  - Delete `src/components/admin/control-plane/PersonaGenerationDebugCard.tsx`.
- Updated consumers:
  - `PersonaGenerationPreviewSurface.tsx` imports `StageDebugCard` from `@/components/shared/StageDebugCard`.
  - `InteractionPreviewModal.tsx` imports `StageDebugCard` from `@/components/shared/StageDebugCard`.
- Updated type imports:
  - Replace `PersonaGenerationStageDebugRecord` / `PersonaGenerationStageAttemptRecord` with `StageDebugRecord` / `StageDebugAttemptRecord`.
- Simplified preview contract remains intact:
  - `PreviewPanel.tsx` keeps the current simplified sections: rendered preview, raw response, image request, and token budget.
  - `Prompt Assembly`, `Audit Diagnostics`, and `Flow Diagnostics` remain absent from the preview panel.
  - `StageDebugCard` renders low-level stage prompt/attempt data only. It is not a replacement home for the removed preview sections.

---

## Task 1: Update Tests For The New Contract

**Files:**

- Modify: `src/components/admin/control-plane/PreviewPanel.test.ts`
- Modify: `src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`
- Create: `src/components/shared/StageDebugCard.test.tsx`

**Steps:**

1. Remove stale assertions that expect `Prompt Assembly`, `Audit Diagnostics`, or `Flow Diagnostics` in `PreviewPanel` or interaction preview mock output.
2. Add assertions that the simplified preview still renders:
   - `Rendered Preview`
   - `Raw Response`
   - `Image Request`
   - `Token Budget`
   - post title/tags/body rendering for post JSON
   - body-only rendering for comment/reply JSON
3. Optionally assert the intentionally removed labels are absent where that makes the simplification explicit.
4. Add a focused shared component test that imports `StageDebugCard` from `@/components/shared/StageDebugCard`.
5. In that new test, render one stage record with a prompt and two attempts.
6. Assert the collapsed card shows `Stage Debug`, the stage name, and the attempt count.
7. Expand the card and assert it renders `Prompt`, `Responses`, provider/model metadata, finish reason, and error badge.
8. Add a copy fallback test by removing `navigator.clipboard`, stubbing `document.execCommand`, clicking copy, and asserting no exception is thrown.
9. Run:
   ```bash
   npx vitest run src/components/admin/control-plane/PreviewPanel.test.ts src/components/admin/control-plane/InteractionPreviewMockPage.test.ts src/components/shared/StageDebugCard.test.tsx
   ```
   Expected before implementation: fail only because `StageDebugCard` does not exist yet.

---

## Task 2: Extract Generic Stage Debug Types

**Files:**

- Create: `src/lib/ai/stage-debug-records.ts`
- Modify: `src/lib/ai/admin/control-plane-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`

**Steps:**

1. Create `src/lib/ai/stage-debug-records.ts`:

   ```ts
   export type StageDebugRecord = {
     name: string;
     displayPrompt: string;
     outputMaxTokens: number;
     attempts: StageDebugAttemptRecord[];
   };

   export type StageDebugAttemptRecord = {
     attempt: string;
     text: string;
     finishReason: string | null;
     providerId: string | null;
     modelId: string | null;
     hadError: boolean;
   };
   ```

2. In `control-plane-contract.ts`, import `StageDebugRecord` and use it for `PreviewResult.stageDebugRecords`.
3. Remove the old `PersonaGenerationStageDebugRecord` and `PersonaGenerationStageAttemptRecord` exports.
4. Update runtime/admin imports to use `StageDebugRecord`.
5. Run:
   ```bash
   npx tsc --noEmit --pretty false
   ```
   Expected after this task: type errors should only point to the not-yet-moved UI component, if any remain.

---

## Task 3: Move And Rename The Shared Component

**Files:**

- Create: `src/components/shared/StageDebugCard.tsx`
- Delete: `src/components/admin/control-plane/PersonaGenerationDebugCard.tsx`
- Modify: `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
- Modify: `src/components/admin/control-plane/InteractionPreviewModal.tsx`

**Steps:**

1. Move the current component body into `src/components/shared/StageDebugCard.tsx`.
2. Rename:
   - `PersonaGenerationDebugCard` -> `StageDebugCard`
   - local `Props` can stay local, but type its `records` prop as `StageDebugRecord[]`.
3. Import `StageDebugRecord` from `@/lib/ai/stage-debug-records`.
4. Keep the clipboard fallback helper in the component unless a shared clipboard helper already exists.
5. Update persona generation preview and interaction preview imports to use:
   ```ts
   import { StageDebugCard } from "@/components/shared/StageDebugCard";
   ```
6. Replace JSX usage:
   ```tsx
   <StageDebugCard records={preview?.stageDebugRecords ?? undefined} />
   ```
7. Run the shared component test:
   ```bash
   npx vitest run src/components/shared/StageDebugCard.test.tsx
   ```
   Expected: pass.

---

## Task 4: Confirm Simplified Preview Tests

**Files:**

- Modify: `src/components/admin/control-plane/PreviewPanel.test.ts`
- Modify: `src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`

**Steps:**

1. Run:
   ```bash
   npx vitest run src/components/admin/control-plane/PreviewPanel.test.ts src/components/admin/control-plane/InteractionPreviewMockPage.test.ts
   ```
2. If tests fail because they still expect removed sections, update only the assertions.
3. Do not change `PreviewPanel.tsx` to add back removed sections.
4. Keep coverage for:
   - structured post rendering
   - comment/reply body-only rendering
   - image request true/false states
   - token budget display
   - raw response display
   - stage debug card presence when `stageDebugRecords` are provided by the modal

---

## Task 5: Update Docs And Module Map

**Files:**

- Modify: `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- Optionally modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`

**Steps:**

1. Add `StageDebugCard.tsx` to the shared UI list near `ApiErrorDetailModal`, `PersonaDataModal`, and `TaskStatusBadge`.
2. Mention that staged LLM debug payloads use `StageDebugRecord` from `src/lib/ai/stage-debug-records.ts`.
3. Remove any guidance that implies stage debug UI is persona-generation-specific.
4. Keep documentation concise; do not turn the module map into an implementation transcript.

---

## Task 6: Final Verification

**Commands:**

```bash
npx vitest run src/components/shared/StageDebugCard.test.tsx src/components/admin/control-plane/PreviewPanel.test.ts src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts src/components/admin/control-plane/InteractionPreviewMockPage.test.ts
npm run test:llm-flows
npm run typecheck
git diff --check
```

**Expected Results:**

- Shared stage-debug component tests pass.
- Preview panel tests pass without `Prompt Assembly`, `Audit Diagnostics`, or `Flow Diagnostics`.
- Persona generation and interaction preview mock-page tests pass with the renamed component.
- LLM flow tests still pass, confirming the type rename did not change runtime behavior.
- Typecheck passes without old `PersonaGenerationStageDebugRecord` references.
- `git diff --check` reports no whitespace issues.

---

## Review Checkpoints

- Is the type move worth the extra mechanical churn? Yes: a shared UI component should not import a persona/admin-named debug type now that interaction flows emit the same shape.
- Is there a more elegant path than reintroducing removed diagnostics? No. The simpler design is to keep the preview panel lean and let `StageDebugCard` handle only low-level prompt/attempt inspection.
- Scope guard: do not change backend debug collection behavior, token budgets, preview section simplification, or the staged runtime contract beyond the type rename.
