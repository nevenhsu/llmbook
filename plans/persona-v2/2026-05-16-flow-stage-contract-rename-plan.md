# Flow And Stage Contract Rename Plan

> **Status:** Predecessor plan. This plan established the `flow + stage` naming split, but active follow-up work should also read [2026-05-16-tasktype-boundary-hardcut-plan.md](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-16-tasktype-boundary-hardcut-plan.md), which hard-cuts mixed `taskType` usage out of internal persona interaction runtime APIs.

**Goal:** Eliminate the overloaded internal use of `flow` for both user-facing flow families and internal stage steps, and hard-cut the stage-based prompt/runtime contracts onto explicit `flow + stage` naming.

**Architecture:** Public/admin request payloads keep the existing `taskType` field name for now, but its meaning remains the user-facing flow family (`post`, `comment`, `reply`). Internal prompt/runtime/schema/debug contracts move to explicit `flow` and `stage` fields. `post_plan`, `post_frame`, and `post_body` stay post-only internal stages, while single-stage writer flows gain explicit `comment_body` and `reply_body` stage names.

**Tech Stack:** TypeScript, Vitest, `persona-core-v2.ts`, `persona-interaction-stage-service.ts`, `persona-v2-prompt-family.ts`, `persona-v2-flow-contracts.ts`, `persona-runtime-packets.ts`, control-plane preview diagnostics, llm-flow docs.

---

## Resolved Decisions

- `flow` is the user-facing flow family only: `post | comment | reply`.
- `stage` is the internal execution contract step only: `post_plan | post_frame | post_body | comment_body | reply_body`.
- Public/admin request payloads keep the field name `taskType`, but for user-facing interaction work it means flow, not stage.
- Internal stage-based contracts must hard-cut to explicit `flow + stage`; do not preserve old aliases like `flow: "post_plan"` or stage values `comment` / `reply`.
- Internal identity should be represented by primary fields `flow` and `stage`; any single-string lookup key must be derived from them.
- `plan/frame/body` are currently a `post`-only stage family. Do not invent cross-flow generic stage taxonomies in this pass.
- This is a hard-cut migration. Do not add dual-read or dual-write compatibility.

## Non-Goals

- Do not rename public/admin request field names from `taskType` to `flow` in this pass.
- Do not broaden public preview/context-assist/API routes to accept internal stage names.
- Do not redesign post-flow sequencing, schema-gate behavior, or runtime retry behavior.
- Do not introduce new `comment_plan`, `reply_plan`, or generic `plan | frame | body` abstractions.
- Do not attempt to rewrite every archived plan or historical doc; focus on active docs and plans that still read as current guidance.

## Current Problem

The repo currently mixes two different concepts under overlapping names:

- glossary and public runtime already treat `post`, `comment`, and `reply` as the user-facing flow families
- several internal prompt/runtime types still use `post_plan`, `post_frame`, `post_body`, `comment`, and `reply` as if they were all peer `flow` values

That drift shows up in the current code:

- `PersonaFlowKind` in `src/lib/ai/core/persona-core-v2.ts` still mixes post stages with comment/reply writer flows
- `persona-v2-prompt-family.ts`, `persona-v2-flow-contracts.ts`, and `persona-runtime-packets.ts` still branch on stage-like values through a `flow` field
- `persona-interaction-stage-service.ts` still maps `taskType` directly into those mixed internal flow values
- tests and docs still encode the old mixed vocabulary, which makes future refactors and debug output harder to reason about

The practical risk is not cosmetic naming drift. It weakens the boundary between:

- public task family selection
- internal stage sequencing
- schema/debug/budget lookup identity

That makes future work on prompt builders, debug records, and additional stages more error-prone because the same word can mean either product concept or execution step depending on the file.

## Target Shape

### Public boundary

Keep the current public/admin request field name:

```ts
taskType: "post" | "comment" | "reply";
```

Rules:

- `taskType` is a historical field name but its meaning is flow family.
- public routes and stores must continue to reject internal stage names like `post_body`.
- non-user-facing task families like `generic`, `vote`, `poll_post`, and `poll_vote` keep their current handling outside this rename.

### Internal stage contract

Use explicit fields:

```ts
type InteractionFlow = "post" | "comment" | "reply";

type InteractionStage =
  | "post_plan"
  | "post_frame"
  | "post_body"
  | "comment_body"
  | "reply_body";
```

Rules:

- `post` flow may run `post_plan -> post_frame -> post_body`
- `comment` flow runs `comment_body`
- `reply` flow runs `reply_body`
- stage-based helpers must accept `{ flow, stage }`, not a mixed `flow` enum
- any lookup key like schema metadata ids or budget ids should be derived from `flow + stage`

### Internal identity

Use `flow` and `stage` as the canonical primary identity.

When a single key is needed, derive it:

```ts
const flowStageKey = `${flow}:${stage}`;
```

Do not treat `stage` alone as globally sufficient identity.

## Implementation Plan

### Task 1: Replace The Mixed Internal Type Vocabulary

**Files:**

- Modify: `src/lib/ai/core/persona-core-v2.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- Modify: related focused tests under `src/lib/ai/prompt-runtime/`

**Steps:**

- Replace `PersonaFlowKind` or equivalent mixed enums with explicit internal flow/stage types.
- Ensure post-stage prompt helpers already using `{ flow: "post", stage }` become the naming model rather than a local special case.
- Rename internal single-stage writer stage values from `comment` / `reply` to `comment_body` / `reply_body`.
- Update schema-contract builders, runtime packet selection, and budget tables to branch on `flow + stage`.
- Keep prompt-visible semantics unchanged while changing the identity model beneath them.

### Task 2: Rewire Stage-Service Mapping Around `flow + stage`

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Modify if needed: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify if needed: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Steps:**

- Replace `ACTION_TYPE_TO_FLOW` style mappings with explicit resolution from public `taskType` to internal `{ flow, stage }`.
- Keep user-facing preview/runtime entry on `taskType: "post" | "comment" | "reply"`.
- Ensure post public entry still resolves to the proper internal stage at each execution point.
- Keep debug output and prompt assembly working from resolved internal stage identity rather than mixed flow names.

### Task 3: Rename Single-Stage Writer Contracts

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: focused comment/reply flow tests

**Steps:**

- Keep external flow modules named `comment` and `reply`.
- Internally rename the stage identity they execute to `comment_body` and `reply_body`.
- Update attempt labels, budget lookups, schema/meta lookups, and diagnostics that currently use the old mixed stage names.
- Preserve final output result shapes and user-facing flow results.

### Task 4: Normalize Schema, Debug, And Budget Identity

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/admin/control-plane-contract.ts`
- Modify: any stage-debug or failure-reporting helpers touched by the rename

**Steps:**

- Make schema metadata resolve from `flow + stage`.
- Re-key runtime budget tables away from mixed flow/stage enums.
- Ensure debug records, `terminalStage`, attempt labels, and compact failure metadata reflect the new stage names.
- Keep public `flowKind` output on final user-facing flow results where that concept is still product-correct.

### Task 5: Update Active Docs And Plans

**Files:**

- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Modify: `docs/ai-agent/llm-flows/prompt-block-examples.md`
- Modify: `docs/ai-agent/llm-flows/reference-role-doctrine.md`
- Modify: active plans under `plans/persona-v2/` that still read as current and still present mixed flow/stage naming
- Leave archived historical docs alone unless one is still linked as current guidance

**Steps:**

- Reword active docs so they describe `flow` as the user-facing family and `stage` as the internal step.
- Replace stale examples that still imply `comment` and `reply` are both flow names and stage names.
- Add superseded/status banners where an older active-looking plan can no longer be read as current truth after this rename.

## Verification

Run focused checks after implementation:

```bash
npx vitest run \
  src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts \
  src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts \
  src/lib/ai/agent/execution/flows/post-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/comment-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/reply-flow-module.test.ts \
  src/app/api/admin/ai/persona-interaction/preview/route.test.ts
```

Focused review checks:

- public preview/context-assist routes still accept only user-facing task families
- internal prompt/runtime helpers no longer use `flow: "post_plan"` or stage names `comment` / `reply`
- post-flow sequencing is unchanged
- comment/reply final output shapes are unchanged
- debug metadata and `terminalStage` labels match the new stage names

## Risks

- The rename crosses prompt-runtime, flow execution, debug reporting, and tests at once; partial migration will leave the repo in a more confusing state than before.
- `taskType`, `flowKind`, `actionType`, and `stage` already mean slightly different things in different layers; careless edits could accidentally broaden public API scope while trying to clean internal naming.
- Active plans and docs still contain many pre-rename examples. If not updated in the same pass, future work will reintroduce the old mixed language.

## Suggested Execution Order

1. Replace internal core types and lookup tables.
2. Rewire stage-service mapping.
3. Rename single-stage writer stage identities.
4. Re-key schema/debug/budget helpers.
5. Update focused tests.
6. Update active docs/plans to the new contract language.
