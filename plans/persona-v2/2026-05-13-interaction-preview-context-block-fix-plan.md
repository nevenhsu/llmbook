# Interaction Preview Context Block Fix Plan

**Goal:** Fix `/admin/ai/control-plane` Interaction Preview so user/assist-provided content direction appears in `[target_context]`, while `[task_context]` remains flow-owned execution guidance.

**Architecture:** The V2 persona interaction contract treats `target_context` as dynamic source/request context and `task_context` as static or flow-owned task guidance. The current preview API serializes `structuredContext` into `taskContext`, and `AiAgentPersonaInteractionService` passes that string into the flow prompt context as `taskContext`, so post/comment/reply preview prompts can invert the block meanings. The fix should route Interaction Preview request text into `targetContextText` for V2 user-facing flows and use deterministic task guidance per flow, while keeping lean fallback task types (`vote`, `poll_post`, `poll_vote`) on the existing task-context path until they get full V2 blocks.

**Relevant Contracts:**

- `target_context`: dynamic context such as title/content direction, source post/comment, selected plan, recent titles, thread material, or preview request payload.
- `task_context`: static or flow-owned execution instruction, such as "generate a new post", "write a top-level comment", or "reply directly to the source comment".
- Do not expose chain of thought.
- Do not introduce legacy dual-read compatibility beyond the narrow API transition needed for the existing preview textarea payload.
- Skip Chrome/browser preview unless explicitly requested.

---

## Current Failure

Repro payload:

```json
{
  "personaId": "4d75eeba-382b-495d-8de6-b05556061115",
  "modelId": "6a841dc0-0c56-4198-9251-aeb60710df75",
  "taskType": "post",
  "contentMode": "story",
  "structuredContext": {
    "taskType": "post",
    "titleDirection": "Tentacles and Madness: A Cthulhu Mythos Worldbuilding Guide",
    "contentDirection": "Explore the key elements of Lovecraftian horror in worldbuilding, focusing on the design of creatures that evoke cosmic dread, the role of forbidden knowledge, and how to create environments that feel ancient and unknowable. Provide examples of creature features like non-Euclidean anatomy, psychic influence, and environmental decay."
  }
}
```

Current prompt shape:

```text
[target_context]
No target context available.

[task_context]
Title direction: Tentacles and Madness: A Cthulhu Mythos Worldbuilding Guide
Content direction: Explore the key ...
```

Expected prompt shape:

```text
[target_context]
Title direction: Tentacles and Madness: A Cthulhu Mythos Worldbuilding Guide
Content direction: Explore the key ...

[task_context]
Flow-owned instruction describing the expected content/action.
```

## Root Cause Hypothesis

The shared prompt family is probably correct: `buildPersonaPromptFamilyV2()` renders `target_context` from `input.targetContext` and `task_context` from `input.taskContext`.

The inversion is introduced before that boundary:

- `src/app/api/admin/ai/persona-interaction/preview/route.ts` serializes `structuredContext` into `resolvedTaskContext`.
- `src/lib/ai/admin/control-plane-store.ts` exposes `previewPersonaInteraction()` with only `taskContext`, `boardContext`, and `targetContext`; it does not accept `targetContextText`.
- `src/lib/ai/agent/execution/persona-interaction-service.ts` builds `promptContext.taskContext = input.taskContext` for user-facing preview flows.
- `post` then feeds that string into `buildPlanningTaskContext()`, and `comment`/`reply` pass it straight into their single-stage writer flow.

Production task-driven paths already show the desired model in `src/lib/ai/agent/execution/persona-task-context-builder.ts`: static task instructions live in `taskContext`, while dynamic source/thread/recent-post data live in `targetContextText`.

## Implementation Plan

### Task 1: Add A Regression At The API Boundary

**Files:**

- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

**Steps:**

- Add a failing test for `taskType: "post"` with `structuredContext`.
- Assert the store receives serialized title/content directions as `targetContextText`, not as `taskContext`.
- Assert the store receives a deterministic post preview task instruction in `taskContext`.
- Keep the existing "prefers structuredContext over taskContext" assertion, but update it to assert precedence for `targetContextText`.
- Add a second focused case for manual textarea text with `taskType: "comment"` so the legacy `taskContext` request field is also treated as dynamic target text for user-facing preview flows.
- Verify RED:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts
```

Expected initial failure: `previewPersonaInteraction` is still called with serialized structured context under `taskContext` and no `targetContextText`.

### Task 2: Thread `targetContextText` Through The Store Preview Entry

**Files:**

- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.ts`

**Steps:**

- Extend `AdminAiControlPlaneStore.previewPersonaInteraction()` input with optional `targetContextText?: string` and `boardContextText?: string` only if needed by existing service types.
- In the route, split request text by flow family:
  - For `post`, `comment`, `reply`: serialize `structuredContext` or fallback `body.taskContext` into `targetContextText`.
  - For `vote`, `poll_post`, `poll_vote`: keep the existing `taskContext` behavior because lean fallback blocks only include `task_context`.
- Add a small local helper such as `isUserFacingPreviewTaskType(taskType)` in the route or shared module.
- If both `targetContext` object and `structuredContext`/manual text are present for `post`, `comment`, or `reply`, preserve both by passing the serialized request text as `targetContextText` and still passing normalized `targetContext`; the service will decide how to combine them in Task 3.
- Verify the route test turns GREEN.

### Task 3: Make User-Facing Preview Build Static Task Guidance

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`

**Steps:**

- Add a deterministic helper, for example:

```ts
function buildPreviewTaskContext(input: {
  taskType: "post" | "comment" | "reply";
  contentMode?: ContentMode;
}): string;
```

- Suggested outputs:
  - `post`: "Generate a new post using the dynamic target context below. Treat title/content direction as request constraints, not as text to copy verbatim. Keep the output aligned to the selected content mode."
  - `comment`: "Generate a top-level comment using the dynamic target context below. Stand on its own and add net-new value."
  - `reply`: "Generate a reply using the dynamic target context below. Respond directly to the provided source/comment chain and move the exchange forward."
- In the user-facing branch of `AiAgentPersonaInteractionService.run()`, set `promptContext.taskContext` from that helper instead of `input.taskContext`.
- Build `promptContext.targetContextText` from these sources:
  - explicit `input.targetContextText`
  - formatted `input.targetContext`
  - legacy/manual `input.taskContext` when no explicit target text exists
- If more than one dynamic target source is present, join non-empty chunks with a blank line, with explicit labels only where the formatter already supplies them.
- Keep non-user-facing `vote`, `poll_post`, and `poll_vote` path unchanged.
- Add tests that prove:
  - `post` preview prompt contains title/content direction under `[target_context]`.
  - `post` preview prompt does not contain title/content direction under `[task_context]`.
  - `comment` and `reply` preview prompts do the same for manual request text.
  - preformatted `boardContextText` and `targetContextText` still win over structured objects.
- Verify RED before implementation and GREEN after implementation:

```bash
npx vitest run src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

### Task 4: Check The Stage Service Contract Stays Correct

**Files:**

- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Reference: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Reference: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`

**Steps:**

- Do not change `buildPersonaPromptFamilyV2()` unless tests prove it is wrong.
- Add or adjust a stage-service test only if needed to lock the lower-level invariant:
  - when `taskContext` and `targetContextText` are supplied separately, the assembled prompt renders them in separate blocks.
- Keep this layer dumb: it should render the inputs it is given and should not infer preview semantics.
- Verify:

```bash
npx vitest run src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts
```

### Task 5: Sweep All Interaction Preview Flow Types

**Files:**

- Modify tests as needed:
  - `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
  - `src/components/admin/control-plane/sections/PersonaInteractionSection.test.ts`
  - `src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`

**Steps:**

- Run focused tests for the preview API, store, service, stage service, and control-plane section.
- If UI tests only assert textarea state, keep them unchanged unless the payload contract changes at the component/hook layer.
- Confirm post/comment/reply use `target_context` for dynamic preview context.
- Confirm vote/poll fallback still uses `task_context`.
- Do not use browser preview.

Verification command:

```bash
npx vitest run src/app/api/admin/ai/persona-interaction/preview/route.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts src/components/admin/control-plane/sections/PersonaInteractionSection.test.ts src/components/admin/control-plane/InteractionPreviewMockPage.test.ts
```

### Task 6: Final Verification

**Steps:**

- Run a no-browser code-level verification:

```bash
npx tsc --noEmit
```

- If `tsc` is blocked by a pre-existing repo-level config issue, record the exact error and rely on focused Vitest plus diff review for this change.
- Run:

```bash
git diff --check
```

- Manually inspect the generated prompt fixture in failing tests or debug records to confirm the exact desired shape:

```text
[target_context]
Title direction: ...
Content direction: ...

[task_context]
Generate a new post ...
```

## Acceptance Criteria

- `structuredContext` for `post`, `comment`, and `reply` no longer lands in `[task_context]`.
- Manual Interaction Preview textarea text for `post`, `comment`, and `reply` is treated as dynamic target/request context, not flow-owned task guidance.
- `[task_context]` for user-facing preview flows is deterministic and describes expected action/content.
- Existing preformatted `targetContextText` support remains intact for runtime/flow-module callers.
- Lean fallback task types keep existing behavior until their full V2 prompt blocks exist.
- Focused tests pass, or any failure is documented as unrelated/pre-existing with exact command output.

## Non-Goals

- Do not redesign Interaction Preview UI labels in this pass.
- Do not change `buildPersonaPromptFamilyV2()` block order.
- Do not modify persona runtime packet generation.
- Do not add browser preview verification.
- Do not add backward-compatible legacy prompt paths.
