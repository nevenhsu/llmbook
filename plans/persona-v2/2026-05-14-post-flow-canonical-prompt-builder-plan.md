# Post Flow Canonical Prompt Builder Plan

**Goal:** Refactor post-flow prompt ownership so `post_plan`, `post_frame`, and `post_body` prompt-visible text lives in one prompt-runtime module while runtime and admin preview keep using the existing shared V2 outer entrypoint.

**Architecture:** Keep `buildPersonaPromptFamilyV2()` as the stable outer assembler and keep `post` as the only public post-flow entry. Extract a post-specific prompt-runtime owner module behind that seam; it should own post-stage instruction text and prompt-visible handoff rendering, while `post-flow-module.ts` keeps only sequencing, candidate selection, frame passing, and failure handling.

**Tech Stack:** TypeScript, Vitest, `buildPersonaPromptFamilyV2()`, `post-flow-module.ts`, `persona-interaction-stage-service.ts`, `persona-v2-flow-contracts.ts`, `PostFrameSchema`, control-plane preview diagnostics.

---

## Resolved Decisions

- Canonical unit is the `post` flow, not three public stage builders.
- `post_plan`, `post_frame`, and `post_body` stay internal implementation stages.
- `buildPersonaPromptFamilyV2()` remains the stable outer entrypoint.
- Preview/debug must show real per-stage prompts through `stageDebugRecords`, not a synthetic prebuilt bundle.
- `output_contract` stays in `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts` beside the schemas and repair metadata.
- The new post prompt-runtime owner should model `flow: "post"` plus explicit stage input.
- The new post prompt-runtime owner should own stage instruction text.
- The new post prompt-runtime owner should also own prompt-visible post-stage handoff rendering such as selected-plan and post-frame blocks.
- `post-flow-module.ts` should become orchestration-only; do not leave prompt wording drift split between the flow module and prompt-runtime.

## Non-Goals

- Do not turn `post_plan`, `post_frame`, or `post_body` into new admin/public API task types.
- Do not refactor `comment` or `reply` into their own new builder modules in this pass.
- Do not move `output_contract` generation out of `persona-v2-flow-contracts.ts`.
- Do not redesign `buildPersonaPromptFamilyV2()` block order.
- Do not change the schema-gate boundary, `PostFrameSchema`, or persistence contracts unless the refactor exposes a concrete defect that requires follow-up work.
- Do not rewrite preview/debug around a synthetic all-stages prompt bundle.

## Current Problem

The live repo already has the right macro-shape for post flow:

- user-facing preview/runtime enters through `taskType: "post"`
- `post-flow-module.ts` internally runs `post_plan -> post_frame -> post_body`
- `buildPersonaPromptFamilyV2()` is already the shared V2 outer assembler

The drift problem is lower-level ownership:

- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts` owns post-stage `action_mode_policy` and `content_mode_policy`
- `src/lib/ai/agent/execution/flows/post-flow-module.ts` separately owns:
  - planning/frame/body `taskContext` strings
  - selected-plan target block rendering
  - post-frame target block rendering

That means the prompt-visible behavior for one post flow is split across prompt-runtime and orchestration code. The risk is not only duplicated text, but semantic drift:

- a prompt-family edit can change stage policy while post-flow task guidance stays stale
- a flow-module edit can change what later stages see without the shared prompt-family tests noticing
- future post-flow prompt work has no single ownership file to inspect first

## Target Shape

### Canonical post prompt-runtime owner

Add a post-specific prompt-runtime module:

```text
src/lib/ai/prompt-runtime/post/post-prompt-builder.ts
src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts
```

This file becomes the canonical owner for post-stage prompt text. Keep the exports narrow and post-specific rather than introducing a new repo-wide prompt-build abstraction.

Recommended surface:

```ts
export type CanonicalPostStage = "post_plan" | "post_frame" | "post_body";

export function buildPostStageActionModePolicy(input: {
  flow: "post";
  stage: CanonicalPostStage;
}): string;

export function buildPostStageContentModePolicy(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
}): string;

export function buildPostStageTaskContext(input: {
  flow: "post";
  stage: CanonicalPostStage;
  contentMode: ContentMode;
  baseTaskContext?: string;
}): string;

export function renderSelectedPostPlanTargetContext(plan: SelectedPostPlan): string;

export function renderPostFrameTargetContext(input: {
  frame: PostFrame;
  contentMode: ContentMode;
}): string;
```

Notes:

- The module may expose a small internal helper that bundles stage-owned strings together, but do not force callers to consume a larger new generic prompt result shape.
- Keep prompt-visible text in prompt-runtime; keep sequencing and retries in the flow module.
- `SelectedPostPlan` and `PostFrame` handoff renderers belong here because they define what the next stage actually sees.

### Stable outer entrypoint stays put

`buildPersonaPromptFamilyV2()` must remain the shared outer assembler. It should delegate post-stage policy ownership internally:

- when `flow` is `post_plan`, `post_frame`, or `post_body`, map that to canonical `flow: "post"` plus stage
- source post-stage `action_mode_policy` and `content_mode_policy` from the new post module
- keep `comment` and `reply` on the current in-file path for now
- keep the existing assembled result contract:
  - `assembledPrompt`
  - `blocks`
  - `messages`
  - `blockOrder`
  - `warnings`

### Flow module becomes orchestration-only

`post-flow-module.ts` should stop owning prompt-visible strings. After the refactor it should only own:

- stage sequencing
- plan candidate validation and selection
- frame parsing
- body parsing
- failure classification
- diagnostics and `stageDebugRecords`

Prompt-visible text should move out:

- planning-stage `taskContext`
- framing-stage `taskContext`
- body-stage `taskContext`
- `[selected_post_plan]` rendering
- `[post_frame]` rendering

The flow module should call prompt-runtime helpers for those values instead of building them inline.

## Implementation Plan

### Task 1: Add The Canonical Post Prompt-Runtime Owner

**Files:**

- Add: `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`
- Add: `src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts`

**Steps:**

- Create the new `prompt-runtime/post` module.
- Move post-stage prompt-visible strings into this file:
  - stage instruction text for `post_plan`, `post_frame`, `post_body`
  - selected-plan target-context rendering
  - post-frame target-context rendering
- Keep the implementation post-specific; do not generalize this into a new cross-flow prompt toolkit.
- Add focused tests for:
  - `post_plan` discussion vs story policy wording
  - `post_frame` discussion vs story policy wording
  - `post_body` keeps the locked-title/no-rewrite rule
  - selected-plan renderer includes locked title, idea, and outline in one stable block
  - post-frame renderer includes mode, beats, required details, ending direction, tone, and avoid list
  - no helper reintroduces retired stage labels or legacy planner/writer shell text

### Task 2: Delegate Post Policy Ownership From The Shared V2 Outer Entry

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

**Steps:**

- Keep `buildPersonaPromptFamilyV2()` as the stable exported entrypoint.
- Add a small mapping from:
  - `post_plan`
  - `post_frame`
  - `post_body`
    into canonical `flow: "post"` plus explicit stage.
- Replace inline post-stage `action_mode_policy` and `content_mode_policy` generation with calls into `post-prompt-builder.ts`.
- Leave `comment` and `reply` inline for this pass.
- Keep block order unchanged.
- Keep `output_contract` sourcing unchanged.
- Add or update tests proving:
  - post stages still assemble through the same outer block order
  - post-stage prompts still differ by content mode
  - comment/reply behavior does not regress
  - the family result still exposes the same outer contract and no preview-only wrapper shape appears

### Task 3: Rewire `post-flow-module.ts` To Consume Canonical Post Prompt Text

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

**Steps:**

- Delete the inline prompt-text helpers from `post-flow-module.ts`:
  - `buildPlanningTaskContext()`
  - `buildPostFrameTaskContext()`
  - `buildPostBodyTaskContext()`
  - `buildSelectedPostPlanBlock()`
  - `buildPostFrameBlock()`
- Replace them with imports from `post-prompt-builder.ts`.
- Keep runtime flow behavior unchanged:
  - planning still uses the upstream task/request context plus planning-only constraints
  - frame still runs against the selected plan
  - body still runs against selected plan + post frame
- Keep `post-flow-module.ts` focused on orchestration and typed stage data, not string assembly.
- Add or update tests proving:
  - the module still invokes `post_plan`, `post_frame`, and `post_body` in order
  - frame stage receives canonical selected-plan target context
  - body stage receives canonical selected-plan plus post-frame target context
  - story-mode framing/body still thread `contentMode`
  - failure diagnostics and `terminalStage` behavior remain unchanged

### Task 4: Keep Preview / Stage-Service Contracts Stable

**Files:**

- Modify if needed: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify if needed: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Modify if needed: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Modify if needed: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

**Steps:**

- Do not broaden the preview route contract.
- Keep public preview entry on `taskType: "post"`.
- Keep direct stage execution as an internal/testing seam only.
- Only touch stage-service code if the post-builder extraction requires a small compatibility shim; avoid changing its public input contract unless strictly necessary.
- Preserve the existing preview/debug model:
  - real per-stage execution
  - `stageDebugRecords`
  - no synthetic all-stages preview bundle
- Update tests only where prompt wording or prompt-source ownership changes require expectation updates.

### Task 5: Update Ownership Docs

**Files:**

- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Modify: `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`

**Steps:**

- Update prompt-family architecture docs so the current contract explicitly says:
  - `buildPersonaPromptFamilyV2()` is the stable outer assembler
  - post-stage prompt text is owned by the new `prompt-runtime/post` module
  - `post-flow-module.ts` owns sequencing and diagnostics, not post prompt wording
- Update the control-plane module map so preview/runtime ownership points prompt edits first to the new post prompt-runtime module, not to `post-flow-module.ts`.
- Remove or revise stale wording that still implies flow modules own prompt assembly details directly.

### Task 6: Extend Hardcode Guard Coverage If The New File Becomes Production Prompt Surface

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

**Steps:**

- Add `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts` to the production prompt-surface guard list if the new module contains production prompt text.
- Keep the same guarantees:
  - no sentinel strings
  - no fixture imports
  - no provider-specific branches
- Do not broaden the guard beyond files that truly own production prompt text.

## Verification

Run focused verification for the touched post-flow prompt-runtime seam:

```bash
npx vitest run \
  src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/agent/execution/flows/post-flow-module.test.ts \
  src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts \
  src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts \
  src/app/api/admin/ai/persona-interaction/preview/route.test.ts \
  src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts
```

Then run:

```bash
npx tsc --noEmit
git diff --check
```

If `tsc` is blocked by pre-existing repo failures, report that separately from the refactor and do not treat it as proof that the prompt-runtime extraction is wrong.

## Full Related File List

Primary implementation targets:

- `src/lib/ai/prompt-runtime/post/post-prompt-builder.ts`
- `src/lib/ai/prompt-runtime/post/post-prompt-builder.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`

Likely verification / compatibility touchpoints:

- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

Ownership docs:

- `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- `docs/ai-admin/CONTROL_PLANE_MODULE_MAP.md`

Reference-only context:

- `plans/canonical-flow-prompt-builder-handoff-prompt.md`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- `src/lib/ai/agent/execution/persona-interaction-service.ts`

## Acceptance Criteria

- `post` remains the only public post-flow task type for preview/runtime orchestration.
- `buildPersonaPromptFamilyV2()` stays the stable outer entrypoint.
- Post-stage prompt-visible text has one prompt-runtime ownership module.
- `post-flow-module.ts` no longer owns prompt wording or prompt-visible handoff block formatting.
- Preview/debug still reflects real `post_plan`, `post_frame`, and `post_body` execution through `stageDebugRecords`.
- `output_contract` ownership remains beside `PostPlanOutputSchema`, `PostFrameSchema`, and `PostBodyOutputSchema`.
- Focused tests pass, or any unrelated failure is documented explicitly.
