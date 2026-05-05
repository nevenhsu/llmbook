# Persona Generation Preview Review Fixes Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Fix the six review findings from commit `e6f1c6ba80fc3c8d9e56632` without widening the persona-generation control-plane behavior.

**Architecture:** Keep the existing staged persona-generation flow. Tighten error boundaries, preserve typed diagnostics, validate repair deltas through the stage parsers, and make the debug UI state match the hook behavior. Avoid compatibility branches; this code is in active development and should use the latest contract as the source of truth.

**Tech Stack:** Next.js route handlers, React client components, Vitest, TypeScript, shared LLM flow helpers under `src/lib/ai/admin`.

---

## Findings Covered

1. Runtime failures can return blank previews.
2. Final repair quality errors are reclassified.
3. Save button can re-enable but still no-op.
4. Merged repair deltas are not re-parsed through the stage schema.
5. `debug` flag is accepted but not honored.
6. Clipboard fallback can throw before fallback runs.

## References

- `src/lib/ai/admin/persona-generation-preview-service.ts`
- `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- `src/app/api/admin/ai/persona-generation/preview/route.ts`
- `src/hooks/admin/useAiControlPlane.ts`
- `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
- `src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts`
- `src/components/admin/control-plane/PersonaGenerationDebugCard.tsx`
- `docs/dev-guidelines/08-llm-json-stage-contract.md`

---

## Task 1: Scope Runtime Failure Handling

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:** Unknown runtime failures must reject the preview request instead of returning a successful blank preview. Only markdown render validation should return `renderOk: false`.

**Steps:**

1. Add a failing test that makes `invokeLLM` or `resolveLlmInvocationConfig` throw a generic `Error`.
2. Assert `mockStore().previewPersonaGeneration(...)` rejects with that generic error and does not return fallback `structured` data.
3. Run:
   ```bash
   npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
   ```
   Expected before implementation: new test fails because a fallback preview is returned.
4. Move the broad fallback catch so it wraps only `markdownToEditorHtml(markdown)`.
5. Preserve the existing behavior where render validation errors return `renderOk: false` with the successfully generated `structured` payload.
6. Re-run the focused test command. Expected after implementation: all tests in the file pass.

## Task 2: Preserve Final Quality Repair Errors

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:** When the second quality-repair attempt still produces quality issues, the thrown `PersonaGenerationQualityError` should keep the final issues and not be wrapped as a parse or merge failure.

**Steps:**

1. Extend the existing "throws a typed quality error when persona_core quality repair still fails" test.
2. Assert the rejected error is `PersonaGenerationQualityError`.
3. Assert `error.issues` contains the final repaired quality issue, not the earlier pending issue.
4. Assert `error.message` matches the quality failure path, not `quality repair delta parse or merge failed`.
5. Run:
   ```bash
   npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
   ```
   Expected before implementation: assertion shows the error is misclassified or has the wrong issue set.
6. In the quality repair loop catch block, rethrow `PersonaGenerationQualityError` before building a parse/merge failure.
7. Re-run the focused test command. Expected after implementation: all tests in the file pass.

## Task 3: Re-Parse Merged Repair Deltas

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:** A repair delta must still satisfy the stage parser after merging. Invalid nested shapes or extra keys should fail at the stage-local repair point with useful diagnostics.

**Steps:**

1. Add a failing test where quality repair returns a delta that deep-merges into an invalid stage, such as an extra key inside `interaction_defaults` or a wrong `value_hierarchy` shape.
2. Assert the first invalid delta causes a retry when a valid second delta is available.
3. Add a separate assertion, or extend the failure test, so repeated invalid merged deltas reject with stage-local diagnostics.
4. Run:
   ```bash
   npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
   ```
   Expected before implementation: invalid merged data is not attributed to the repair delta early enough.
5. After `deepMergeJson(...)`, run the merged candidate through `stageInput.parse(JSON.stringify(mergedStage))`.
6. Pass the parsed/normalized candidate into `collectStageQualityResult(...)`.
7. Preserve the retry behavior for first-attempt parse failures.
8. Re-run the focused test command. Expected after implementation: all tests in the file pass.

## Task 4: Fix Save State After Identity Edits

**Files:**

- Modify: `src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
- Modify: `src/hooks/admin/useAiControlPlane.ts`
- Test: `src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts`

**Intent:** The save button state and hook behavior must agree after a generated persona has been saved.

**Preferred Decision:** Keep post-save identity edits non-persistable in this modal. Once `lastSavedAt` is set, keep the completed state locked until regeneration or a new preview resets `lastSavedAt`.

**Steps:**

1. Add a component test that renders a success preview with `lastSavedAt` set.
2. Edit the display name input.
3. Assert the primary button still shows the completed label and does not call `onSave`.
4. Run:
   ```bash
   npx vitest run src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts
   ```
   Expected before implementation: the button appears saveable after the edit.
5. Remove local `formChanged` save-state override, or gate identity inputs when `lastSavedAt` is set.
6. Keep the hook's existing `if (personaLastSavedAt) return;` guard.
7. Re-run the focused component test.

## Task 5: Make Debug Payload Contract Explicit

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/app/api/admin/ai/persona-generation/preview/route.ts`
- Modify: `src/hooks/admin/useAiControlPlane.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:** The `debug` flag should either control debug payload exposure or be removed. Because the UI now intentionally requests debug data, keep the flag and gate `stageDebugRecords` on it.

**Steps:**

1. Add a store test where `debug` is omitted and assert the successful preview does not expose `stageDebugRecords`.
2. Add a store test where `debug: true` is passed and assert `stageDebugRecords` are present.
3. Add an error-path test, if practical, to assert debug records only appear on typed errors when `debug: true`.
4. Run:
   ```bash
   npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
   ```
   Expected before implementation: debug records are returned regardless of the flag.
5. Keep collecting local debug records internally for diagnostics, but include them in returned preview/error details only when `input.debug === true`.
6. Confirm `useAiControlPlane.ts` still sends `debug: true` for create and update preview.
7. Re-run the focused store test command.

## Task 6: Guard Clipboard Fallback

**Files:**

- Modify: `src/components/admin/control-plane/PersonaGenerationDebugCard.tsx`
- Test: `src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts`

**Intent:** Copy buttons should not throw when `navigator.clipboard` is unavailable.

**Steps:**

1. Add a component test that removes or undefines `navigator.clipboard`, expands the debug card, and clicks a copy button.
2. Assert no exception is thrown and a fallback textarea copy path is attempted.
3. Run:
   ```bash
   npx vitest run src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts
   ```
   Expected before implementation: click throws before fallback.
4. Replace `navigator.clipboard.writeText(text).catch(...)` with a guarded async path:
   - if `navigator.clipboard?.writeText` exists, try it first;
   - on rejection or absence, use the textarea fallback;
   - wrap fallback cleanup in `finally`.
5. Re-run the focused component test.

## Final Verification

Run the focused suites first:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
npx vitest run src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts
```

Then run broader checks:

```bash
npm run test:llm-flows
npm run typecheck
git diff --check
```

Expected result: all commands exit successfully, with no new type errors or whitespace errors.

## Review Notes

- Keep changes narrowly scoped to the reviewed files.
- Do not add dual-read or compatibility paths.
- Use the stage parser as the runtime contract for merged LLM JSON repair deltas.
- Keep UI diagnostics useful, but avoid exposing raw prompt/response debug data unless explicitly requested by the UI.
