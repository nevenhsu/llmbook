# Persona Generation Canonical Prompt Builder Plan

**Goal:** Refactor generate-persona prompt assembly so runtime invocation and admin `View Prompt` both consume one canonical prompt builder. Remove the duplicated preview-only prompt path and make prompt edits happen in one shared `prompt-runtime` location.

**Architecture:** `generate persona` remains a one-stage `persona_core_v2` flow, but its prompt assembly should stop pretending to be a staged preview/template system. The canonical builder should live under `src/lib/ai/prompt-runtime/persona/`, return only generic prompt-building data (`assembledPrompt`, `blocks`, `messages`), and be consumed by both runtime/admin callers. Admin preview/token-budget presentation stays outside the builder.

**Resolved Decisions:**

- Runtime prompt assembly is the canonical source of truth.
- Generate-persona prompt assembly should use a single prompt bundle object, not a legacy `stages[]` shape.
- The shared builder should live in `src/lib/ai/prompt-runtime/persona/`, not under `src/lib/ai/admin/`.
- The builder result should stay generic; admin preview metadata like `PromptAssemblyPreview`, token-budget labels, and modal copy should be derived by consumers.
- This plan is scoped to generate-persona only, while establishing the target folder shape for future persona prompt builders.

**Non-Goals:**

- Do not migrate prompt-assist or interaction-context-assist in this change.
- Do not change the one-stage `persona_core_v2` contract or schema-gate behavior.
- Do not reintroduce staged preview language or multi-stage compatibility shims.

---

## Current Problem

The code still has two prompt-assembly paths for generate-persona:

- `src/lib/ai/admin/persona-generation-preview-service.ts`
  - builds runtime prompt blocks inline via `commonBlocks` and `buildStagePrompt()`
- `src/lib/ai/admin/persona-generation-prompt-template.ts`
  - builds a separate preview/template prompt via another `commonBlocks` definition and `PERSONA_GENERATION_TEMPLATE_STAGES`

This creates the exact maintenance problem the user called out:

- prompt edits must be made in two places
- preview can drift from the real runtime payload
- admin surfaces still talk about staged prompt assembly even though the live contract is one-stage `persona_core_v2`

There is also doc drift around module ownership:

- `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md` still describes `persona-generation-prompt-template.ts` as the prompt/template preview module under `src/lib/ai/admin/*`

## Target Shape

Introduce a shared builder namespace:

```text
src/lib/ai/prompt-runtime/persona/
  generation-prompt-builder.ts
```

Recommended exported surface:

```ts
type PersonaGenerationPromptBuildResult = {
  assembledPrompt: string;
  blocks: Array<{
    name: string;
    content: string;
  }>;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
};

function buildPersonaGenerationPrompt(input: {
  extraPrompt: string;
  referenceNames: string;
}): PersonaGenerationPromptBuildResult;
```

Key rules for the new builder:

- keep all static generate-persona prompt constants in this file or its local folder
- keep placeholder rendering for `extraPrompt` and `referenceNames` in this builder
- keep the contract text one-stage and non-staged
- do not return admin-only preview shape
- do not encode `blockOrder` or `warnings` unless a real runtime caller needs them

## Implementation Plan

### Task 1: Create The Shared Persona Prompt-Runtime Builder

**Files:**

- Add: `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts`
- Add: `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.test.ts`

**Steps:**

- Move the generate-persona static prompt content out of `src/lib/ai/admin/persona-generation-prompt-template.ts` into the new shared builder file.
- Keep all generate-persona prompt-related constants together in the new persona prompt-runtime folder.
- Replace the old stage-array/template model with one builder entrypoint that returns:
  - `assembledPrompt`
  - `blocks`
  - `messages`
- Flatten stage-era naming from the builder API:
  - retire `PERSONA_GENERATION_TEMPLATE_STAGES`
  - retire `buildPersonaGenerationPromptTemplatePreview()`
  - retire `renderPersonaGenerationStageContract()` in favor of a non-stage-specific contract renderer/helper
- Keep the existing content contract intact:
  - one-stage `persona_core_v2`
  - no hardcoded key/type JSON schema blocks
  - `extraPrompt` and `referenceNames` placeholder behavior preserved
- Add focused tests that prove:
  - runtime/admin inputs produce the same assembled prompt
  - no legacy `seed` or multi-stage artifacts remain
  - no `### Stage 1` formatting is produced
  - `referenceNames` and `extraPrompt` injection rules match current behavior

### Task 2: Rewire Runtime Preview Service To Consume The Canonical Builder

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Reference: `src/lib/ai/admin/control-plane-shared.ts`

**Steps:**

- Remove the inline `commonBlocks` definition and local `buildStagePrompt()` assembly path.
- Import and use `buildPersonaGenerationPrompt()` as the only source of:
  - provider prompt text
  - display prompt text
  - prompt blocks used for token estimation/debug display
- Keep `previewPersonaGeneration()` responsible for runtime orchestration only:
  - model/provider resolution
  - `invokeStructuredLLM`
  - schema-gate handling
  - deterministic quality checks
  - preview payload assembly
- Replace any stage-count-based token-budget math with single-prompt bundle math derived from builder output.
- Keep `stageDebugRecords` compatible with the existing shared debug UI, but do not let the builder itself depend on `StageDebugRecord`.

### Task 3: Rewire Admin Prompt Preview To Derive Presentation From The Shared Builder

**Files:**

- Modify: `src/components/admin/control-plane/sections/PersonaGenerationSection.tsx`
- Modify: `src/components/admin/control-plane/PromptAssemblyModal.tsx`
- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify tests as needed:
  - `src/lib/ai/admin/persona-generation-preview-service.test.ts`
  - `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
  - `src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts`
  - any prompt-assembly modal or preview mock tests touched by the contract change

**Steps:**

- Stop importing prompt preview data from the retired admin template file.
- Derive admin preview state from the shared builder result plus admin-side token-budget calculation.
- Update modal copy so generate-persona no longer presents itself as a staged prompt bundle.
- Preserve the ability to inspect block-level prompt text, but frame it as one prompt bundle instead of one generation stage.
- Update or replace the old `persona-generation-prompt-template` tests with tests against the new builder and any admin-side preview adapter logic.

### Task 4: Delete The Old Admin Template Path And Align Ownership Docs

**Files:**

- Delete: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- Modify any imports/tests/mocks still pointing at the old file

**Steps:**

- Remove the deprecated admin-local template module completely.
- Update the module map so generate-persona prompt assembly ownership moves from `src/lib/ai/admin/*` to `src/lib/ai/prompt-runtime/persona/*`.
- Keep the docs explicit that admin preview is a consumer of shared prompt-runtime builders, not the owner of a separate prompt-template path.
- If a small persona prompt-runtime folder README or index export is useful during implementation, keep it scoped to ownership/discoverability, not new behavior.

### Task 5: Verification

**Steps:**

- Run focused tests for:
  - shared builder
  - preview service
  - control-plane section/modal
  - any touched mocks
- Run:

```bash
npx tsc --noEmit
```

- Run:

```bash
git diff --check
```

- Manually confirm the new source-of-truth boundary:
  - editing generate-persona static prompt text in `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts` changes both runtime invocation and admin prompt preview
  - no remaining imports reference `buildPersonaGenerationPromptTemplatePreview`
  - no remaining generate-persona prompt assembly duplicates `commonBlocks`

## Full Related File List

Primary implementation targets:

- `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.ts`
- `src/lib/ai/prompt-runtime/persona/generation-prompt-builder.test.ts`
- `src/lib/ai/admin/persona-generation-preview-service.ts`
- `src/components/admin/control-plane/sections/PersonaGenerationSection.tsx`
- `src/components/admin/control-plane/PromptAssemblyModal.tsx`
- `src/lib/ai/admin/persona-generation-preview-mock.ts`
- `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`

Primary deletions/retirements:

- `src/lib/ai/admin/persona-generation-prompt-template.ts`
- `src/lib/ai/admin/persona-generation-prompt-template.test.ts`

Likely verification touchpoints:

- `src/lib/ai/admin/persona-generation-preview-service.test.ts`
- `src/components/admin/control-plane/PersonaGenerationPreviewSurface.test.ts`
- `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

## Review Notes

- This plan intentionally keeps the refactor narrow: one canonical generate-persona builder, one new shared folder, one deleted preview-only template path.
- The broader folder strategy is now established for future persona builders, but this plan does not bundle prompt-assist or AI-context migration into the same change.
