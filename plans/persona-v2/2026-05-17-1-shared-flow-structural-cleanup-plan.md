# 1. Shared Flow Structural Cleanup Plan

**Goal:** Land the cross-flow structural cleanup required before or alongside the new canonical `comment` / `reply` prompt-runtime modules, without rewriting final prompt copy.

**Architecture:** Keep the live admin manual interaction preview feature, but delete mock-only preview scaffolding and retire transport-level prompt-return fields. Prompt inspection should come from `stageDebugRecords` or direct local prompt-runtime helper calls, not from preview API payloads. Delete `execution-preview.ts` by moving any still-useful logic into the real owners instead of preserving another shared helper.

**Tech Stack:** TypeScript, Vitest, admin control-plane preview contracts, `text-runtime-service.ts`, `media-job-service.ts`, prompt-runtime builders, active docs under `docs/ai-agent/llm-flows` and `docs/ai-admin`.

---

## Resolved Decisions

- The reusable `plans/canonical-flow-prompt-builder-handoff-prompt.md` stays unchanged.
- New actionable plans live under `plans/persona-v2`.
- This refactor is structural only; final prompt wording will be updated later.
- Remove `assembledPrompt` from active preview API contracts.
- Tests that need prompt assertions should call canonical prompt-runtime helpers directly.
- Keep the live admin manual interaction preview feature.
- Delete only preview mocks and mock-only preview routes/helpers.
- Ignore archived docs entirely for this pass.
- `execution-preview.ts` should be refactored away and deleted completely.

## Non-Goals

- Do not rewrite final prompt wording for `comment`, `reply`, or persona generation.
- Do not remove the live admin interaction preview route/service.
- Do not update archive docs.
- Do not redesign persona generation prompt-block UI beyond the contract cleanup needed to stop depending on API-returned `assembledPrompt`.

## Task 1: Delete `assembledPrompt` From Active Preview Contracts

**Files:**

- Modify: `src/lib/ai/admin/control-plane-contract.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- Modify: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Modify: `src/components/admin/control-plane/PreviewPanel.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.test.ts`

**Steps:**

- Remove `assembledPrompt` from `PreviewResult`.
- Stop returning placeholder empty-string `assembledPrompt` values from interaction preview.
- Stop returning `assembledPrompt` from persona-generation preview results.
- Rewrite affected tests to stop asserting preview-response prompt text.
- Move prompt assertions to direct calls into canonical prompt-runtime helpers where prompt coverage still matters.

## Task 2: Remove Preview Mock Artifacts Only

**Files:**

- Delete: `src/components/admin/control-plane/InteractionPreviewMockPage.tsx`
- Delete: `src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`
- Delete: `src/lib/ai/admin/interaction-preview-mock.ts`
- Delete: `src/mock-data/interaction-preview.json`
- Delete: `src/app/preview/interaction-preview/page.tsx`
- Modify: `src/app/preview/page.tsx`

**Steps:**

- Delete the interaction preview mock page and its fixture helper/data.
- Delete the mock-only `/preview/interaction-preview` route.
- Remove the link/entry from the generic `/preview` index.
- Keep the real admin manual interaction preview route and modal untouched except where contract cleanup removes stale fields.

## Task 3: Delete `execution-preview.ts` By Moving Its Useful Logic Into Real Owners

**Files:**

- Delete: `src/lib/ai/agent/execution/execution-preview.ts`
- Delete or replace: `src/lib/ai/agent/execution/execution-preview.test.ts`
- Modify: `src/lib/ai/agent/execution/text-runtime-service.ts`
- Modify: `src/lib/ai/agent/execution/text-runtime-service.test.ts`
- Modify: `src/lib/ai/agent/execution/media-job-service.ts`
- Modify: `src/lib/ai/agent/execution/index.ts`
- Modify: `src/lib/ai/agent/client.ts`

**Steps:**

- Move text-runtime dry-run preview assembly into `text-runtime-service.ts` or a text-runtime-local helper.
- Move image request derivation into `media-job-service.ts`.
- Remove all imports/exports of `execution-preview.ts`.
- Ensure nothing in runtime or tests depends on the deleted interaction preview mock layer.

## Task 4: Keep Persona-Generation Prompt Inspection Local

**Files:**

- Modify if needed: `src/components/admin/control-plane/sections/PersonaGenerationSection.tsx`
- Modify if needed: `src/components/admin/control-plane/PromptAssemblyModal.tsx`
- Modify if needed: `src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts`

**Steps:**

- Keep `View Prompt` only if it already builds from local canonical prompt-runtime helpers.
- Do not reintroduce preview-response prompt text for persona generation.
- Update any remaining tests that still assume prompt text arrives through preview API payloads.

## Task 5: Update Active Docs Only

**Files:**

- Modify: `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Modify if needed: `docs/ai-agent/llm-flows/README.md`

**Steps:**

- Remove mentions of `interaction-preview-mock.ts`, `InteractionPreviewMockPage`, and other deleted mock-only preview surfaces.
- Remove current-truth language that says notification-driven thread text reuses `comment`.
- State current truth clearly:
  - `comment` = top-level post comment only
  - `reply` = thread reply only
  - notification-driven thread text routes through `reply`
- Update any active docs that still describe `assembledPrompt` as an API-returned preview field.

## Verification

Run focused verification for shared cleanup:

```bash
npx vitest run \
  src/app/api/admin/ai/persona-interaction/preview/route.test.ts \
  src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts \
  src/components/admin/control-plane/PreviewPanel.test.ts \
  src/lib/ai/admin/persona-generation-preview-service.test.ts \
  src/lib/ai/agent/execution/text-runtime-service.test.ts
git diff --check
```

If `execution-preview.ts` tests are replaced by new owner-local tests, include those new focused files instead of the deleted suite.

## Full Related File List

- contract cleanup:
  - `src/lib/ai/admin/control-plane-contract.ts`
  - `src/lib/ai/agent/execution/persona-interaction-service.ts`
  - `src/lib/ai/admin/persona-generation-preview-service.ts`
- prompt-inspection test fallout:
  - `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
  - `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
  - `src/components/admin/control-plane/PreviewPanel.test.ts`
  - `src/lib/ai/admin/persona-generation-preview-service.test.ts`
- mock deletions:
  - `src/components/admin/control-plane/InteractionPreviewMockPage.tsx`
  - `src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`
  - `src/lib/ai/admin/interaction-preview-mock.ts`
  - `src/mock-data/interaction-preview.json`
  - `src/app/preview/interaction-preview/page.tsx`
  - `src/app/preview/page.tsx`
- runtime preview helper deletion:
  - `src/lib/ai/agent/execution/execution-preview.ts`
  - `src/lib/ai/agent/execution/execution-preview.test.ts`
  - `src/lib/ai/agent/execution/text-runtime-service.ts`
  - `src/lib/ai/agent/execution/text-runtime-service.test.ts`
  - `src/lib/ai/agent/execution/media-job-service.ts`
  - `src/lib/ai/agent/execution/index.ts`
  - `src/lib/ai/agent/client.ts`
- active docs:
  - `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`
  - `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
  - `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
  - `docs/ai-agent/llm-flows/prompt-family-architecture.md`
  - `docs/ai-agent/llm-flows/README.md`
