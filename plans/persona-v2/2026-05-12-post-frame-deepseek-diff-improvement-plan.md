# Plan: Improve The Current DeepSeek `post_frame` Diff

> **Status:** Review-derived improvement plan for the currently staged DeepSeek implementation. This plan is doc-only and is based on the staged diff as inspected on 2026-05-12.

## Goal

Bring the staged `post_frame` implementation to a reviewable state by fixing the real runtime boundary mistakes, aligning the prompt/schema contract, and restoring a green focused test baseline.

## Review Summary

The current diff has the right high-level direction:

- `post_frame` is now treated as a structured stage.
- `PostFrameSchema` exists.
- `post-flow-module.ts` now inserts a `post_frame` step between `post_plan` and `post_body`.
- prompt-family and packet scaffolding for `post_frame` were added.

However, the staged diff is not merge-ready yet because the runtime boundary and validation rules are incomplete, and the touched tests are still red.

## Findings That Drive This Plan

### 1. Story mode is never threaded into the real stage service

`runPostFlow()` computes `contentMode`, but `invokeStage()` never passes it into `runPersonaInteractionStage()`. The stage service then defaults missing `contentMode` to `"discussion"`.

Implication:

- story-mode `post_frame` prompt-family rules are dead in the real runtime
- story-mode `post_frame` persona packets are also dead in the real runtime
- the new story tests only pass because they mock the stage boundary instead of exercising the real content-mode plumbing

Relevant files:

- `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- `src/lib/ai/agent/execution/flows/types.ts`
- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`

### 2. `contentMode` and locked title are still treated as model-authored fields

The staged diff currently makes `content_mode` and `locked_title` part of `PostFrameSchema`, then reasons about validating them after parse.

Implication:

- request-owned context is being delegated to model output unnecessarily
- the flow is spending schema and repair budget on values the app already knows
- the frame contract is larger and more fragile than it needs to be

Relevant file:

- `src/lib/ai/agent/execution/flows/post-flow-module.ts`

### 3. The prompt/output contract still drifts from the intended compact schema

`buildPostFrameOutputContract()` currently asks for:

- `required_detail` singular
- model-authored fields that should be code-owned in the revised contract

The intended compact schema should require:

- `required_details`
- no model-authored `content_mode`
- no model-authored locked title

Implication:

- the first provider call is being told to emit an object that does not actually match the validator
- schema-gate failures will be artificially inflated by prompt/schema drift and unnecessary code-owned fields

Relevant file:

- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`

### 4. The touched focused suite is still red

The staged diff leaves the targeted touched-suite red:

- legacy `post-flow-module.test.ts` cases still assume the older staged behavior and now die at `post_frame`
- `persona-v2-flow-contracts.test.ts` still expects audit exports/helpers that are not present in the touched module

Implication:

- the change is not reviewable on a green local baseline
- new `post_frame` tests were added, but the existing touched suite was not fully rebaselined around the new stage model

Relevant files:

- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`

## Improvement Scope

This plan is intentionally narrow:

- fix the real `post_frame` runtime boundary
- shrink the frame to model-authored content only
- align prompt/schema field naming
- rebaseline the touched test surface

This plan does **not** broaden into:

- new audit stages
- schema-repair or quality-repair reintroduction
- comment/reply framing
- larger prompt-family redesign beyond the `post_frame` contract needed for correctness

## Task 1: Thread `contentMode` Through The Real `post_frame` Runtime Boundary

### Changes

Update the post-flow boundary so `contentMode` is actually passed into the stage service:

- extend `TextFlowModuleRunInput.runPersonaInteractionStage` to accept `contentMode?: ContentMode`
- pass `contentMode` from `runPostFlow()` into all relevant stage calls
- at minimum, ensure `post_frame` receives the requested mode
- preferably also pass `contentMode` for `post_body` and `post_plan` so the post flow uses a single consistent mode contract end-to-end

### Why first

Without this, the story-mode `post_frame` prompt-family branch is unreachable in the real runtime.

### Acceptance

- a story-mode `post_frame` invocation reaches `buildPersonaPromptFamilyV2({ flow: "post_frame", contentMode: "story" })`
- a story-mode `post_frame` persona packet is built with `contentMode: "story"`

## Task 2: Move `contentMode` And Locked Title To Code-Owned Frame Context

### Changes

Remove request-owned fields from the model-authored schema and prompt contract:

- remove `content_mode` from `PostFrameSchema`
- remove locked-title output from `PostFrameSchema`
- stop asking the model to emit either field
- if downstream code wants them for debug/render convenience, attach them after parse from code-owned inputs

### Why

The app already owns these values. They should not consume model output budget or schema/repair surface area.

### Acceptance

- `PostFrameSchema` only contains model-authored framing content
- the selected title remains code-owned
- requested `contentMode` remains code-owned
- downstream flow code can still render or log those values from app context when needed

## Task 3: Align The `PostFrame` Prompt Contract With The Schema

### Changes

Fix `buildPostFrameOutputContract()` so the requested fields match the validator exactly:

- explicitly require `required_details`
- keep the output field names identical to `PostFrameSchema`
- remove singular/plural drift
- remove any request-owned fields from the output contract

Then review the `post_frame` action/content-mode prompt blocks and `buildPostFrameTaskContext()` for the same field-name drift.

### Why

The first structured call should not ask for a different object than the schema gate validates.

### Acceptance

- the output-contract text and `PostFrameSchema` use the same field names
- no singular `required_detail` wording remains in the active `post_frame` path
- no model-authored `content_mode` or locked-title field remains in the active `post_frame` path

## Task 4: Rebaseline The Touched Focused Tests

### `post-flow-module.test.ts`

Update the existing legacy post-flow tests so they match the now-3-stage post flow:

- provide a default valid `post_frame` mock in helper paths that previously only mocked `post_plan` and `post_body`
- keep older assertions meaningful under the new stage order
- add one regression test that exercises content-mode threading instead of only mocking final `post_frame` payloads

### `persona-v2-flow-contracts.test.ts`

Resolve the contract-test drift:

- if audit helpers/schemas are still product truth, restore the missing exports intentionally
- if they are stale and no longer product truth, remove or rewrite those stale expectations

The plan should prefer current product truth over preserving stale tests mechanically.

### Acceptance

- the touched focused `vitest` suite for the modified modules passes
- no existing touched test remains broken purely because `post_frame` was inserted

## Task 5: Tighten Failure Classification Around Real `post_frame` Failures

### Changes

Today parse/coherence failures in the new frame step mostly collapse into generic transport-style errors.

Improve this boundary so:

- schema parse failure on `post_frame` is classified as schema validation

### Why

The diagnostics should reflect whether the failure was:

- malformed structured output
- a true provider/transport problem
- a code/model boundary mistake caught before model generation

## Task 6: Add One Integration-Like Regression Test Around The Real Boundary

The new tests mostly mock `runPersonaInteractionStage()` at a high level, which hides the most important bug in the diff.

Add at least one narrower regression test around the real stage-service boundary or its closest unit seam so it proves:

- a story-mode `post_frame` call does not silently fall back to discussion mode
- `PostFrameSchema` is the schema used for the stage

This can live in either:

- `persona-interaction-stage-service` tests, or
- a dedicated boundary-focused test if one already exists nearby

## Recommended Order

1. Thread `contentMode` through the real stage boundary.
2. Move `contentMode` and locked title to code-owned frame context.
3. Fix `PostFrame` contract/schema field-name drift.
4. Rebaseline the touched focused tests.
5. Tighten failure classification.
6. Add the narrower boundary regression test.

## Verification

### Focused commands

Run focused `vitest` on:

- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`
- any new or updated `persona-interaction-stage-service` test

### Typecheck note

`npx tsc --noEmit` is currently blocked by the repo-level `baseUrl` deprecation error in `tsconfig.json`, so use the project’s normal verification gate once that baseline issue is either resolved or explicitly acknowledged as unrelated.

### Completion criteria

- story-mode `post_frame` uses the story prompt path in the real runtime
- `PostFrameSchema` excludes code-owned mode/title context
- `PostFrame` prompt field names and schema field names match exactly
- the touched focused test surface is green
- diagnostics distinguish schema failure from deterministic mismatch
