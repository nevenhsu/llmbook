# TaskType Boundary Hard-Cut Plan

**Goal:** Remove mixed `taskType` usage from persona interaction internals so active interaction prompt/runtime code uses explicit `flow + stage` only, while `taskType` remains a public or cross-feature boundary label.

**Architecture:** Persona interaction has three distinct concepts and they must stop sharing one mixed type. Public/admin interaction requests keep a dedicated task-family field (`taskType: "post" | "comment" | "reply"`). Cross-feature runtime boundaries may still use a broader task-family union for `generic`, `vote`, and `poll_*`. Internal persona interaction prompt/runtime helpers, diagnostics, and tests must hard-cut to explicit `flow` plus `stage`, with stage sequencing owned only by flow modules or the stage service.

**Tech Stack:** TypeScript, Vitest, `persona-core-v2.ts`, `persona-interaction-stage-service.ts`, `persona-runtime-packets.ts`, `persona-v2-flow-contracts.ts`, `prompt-builder.ts`, admin interaction preview/context-assist routes, llm-flow docs, `CONTEXT.md`.

---

## Relationship To The Prior Plan

This plan is a strict follow-up to [2026-05-16-flow-stage-contract-rename-plan.md](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-16-flow-stage-contract-rename-plan.md).

That plan resolved the naming split between user-facing `flow` and internal `stage`.

This plan resolves the next boundary problem the earlier migration left behind:

- active interaction internals still sometimes accept a mixed `taskType`
- helper code still resolves `taskType -> { flow, stage }` below the public boundary
- legacy prompt-builder types still look like they are active interaction truth

After this plan lands, the earlier rename plan should be read as a predecessor that introduced `flow + stage`, while this plan hard-cuts `taskType` out of internal interaction runtime APIs.

## Resolved Decisions

- `taskType` remains a public or cross-feature task-family label only.
- persona interaction internal helpers must not accept mixed `taskType` values.
- interaction internal functions must take explicit `flow` and `stage`.
- `stage` is decided only by the flow module or the stage service.
- `post` must never be treated as shorthand for `post_body`.
- `flow + stage` applies only to persona interaction text generation, not to `vote`, `poll_post`, `poll_vote`, or `generic`.
- admin interaction preview and context-assist requests should use a dedicated interaction task-family type, not the broad mixed union.
- broad task-family unions should be renamed away from `PromptActionType` so they no longer look like active interaction prompt-runtime truth.
- delete `TASK_TYPE_TO_PERSONA_FLOW_STAGE` and `resolvePersonaPacketFlowStage()` rather than keeping them as convenience helpers.
- test helpers and debug identities must follow the same hard-cut contract.
- this is a hard-cut migration; do not add compatibility aliases or mixed overloads.

## Non-Goals

- Do not rename the public interaction request field name away from `taskType` in this pass.
- Do not persist a duplicate `flow` column beside persisted cross-feature `taskType`.
- Do not force non-interaction task families into fake `flow/stage` shapes.
- Do not redesign post sequencing, schema-gate policy, or provider retry behavior.
- Do not rewrite archived plans or historical docs unless one is still linked as active guidance.

## Current Problem

The repo now has the right domain language in `CONTEXT.md` and core interaction types, but several active APIs still let `taskType` leak into internal interaction helpers.

Current examples:

- `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
  - still imports the mixed `PromptActionType`
  - still exposes `resolvePersonaPacketFlowStage(taskType)`
  - still owns `TASK_TYPE_TO_PERSONA_FLOW_STAGE`
- `src/lib/ai/prompt-runtime/prompt-builder.ts`
  - still defines one mixed union containing `post`, `post_plan`, `post_frame`, `post_body`, `comment`, `reply`, `vote`, `poll_post`, and `poll_vote`
  - still looks like an active interaction source of truth even though active interaction prompt-runtime now lives elsewhere
- admin preview routes and services still often import the broad union when they actually only support interaction task families
- tests still risk teaching the old language if they accept mixed shorthands or resolve `taskType -> { flow, stage }` locally

The risk is no longer just terminology drift. If internal helpers keep accepting `taskType`, the repo will continue to carry hidden shorthand rules like `post => post_body`, and future contributors will reintroduce mixed routing logic even after the `flow + stage` rename.

## Target Shape

### Public And Cross-Feature Boundary

Keep `taskType` where it belongs:

```ts
type PersonaInteractionTaskType = "post" | "comment" | "reply";
```

And separately:

```ts
type RuntimeTaskType =
  | PersonaInteractionTaskType
  | "vote"
  | "poll_post"
  | "poll_vote"
  | "generic";
```

Rules:

- public/admin interaction routes use `PersonaInteractionTaskType`
- queue, runtime config, model adapters, and cross-feature orchestration may use `RuntimeTaskType`
- do not reuse `RuntimeTaskType` inside interaction prompt/runtime helpers

### Internal Interaction Runtime

Internal persona interaction code should accept:

```ts
type PersonaInteractionFlow = "post" | "comment" | "reply";

type PersonaInteractionStage =
  | "post_plan"
  | "post_frame"
  | "post_body"
  | "comment_body"
  | "reply_body";

type PersonaFlowStage = {
  flow: PersonaInteractionFlow;
  stage: PersonaInteractionStage;
};
```

Rules:

- internal helpers must take `{ flow, stage }`
- no internal helper may accept `taskType: "post_plan"` or `taskType: "post_body"`
- no internal helper may treat `post` as implicit `post_body`
- packet builders, output-contract builders, schema-meta lookups, and budget lookups do not infer stage

### Single Parse Boundary

`taskType` is parsed only once at the boundary:

- request or ingestion boundary validates `taskType`
- interaction flow module or stage service resolves the execution `flow` and `stage`
- deeper helpers receive the resolved `flow + stage` and do not reinterpret `taskType`

### Diagnostics Identity

For interaction execution:

- debug and diagnostics primary identity is `flow + stage`
- `terminalStage`, attempt labels, budget lookup keys, and schema/debug metadata must align to `stage`
- `taskType` may appear only as boundary metadata when a public/admin surface needs to show the incoming family

## Implementation Plan

### Task 1: Split And Rename The Mixed Task-Type Unions

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.ts`
- Modify: `src/app/api/admin/ai/persona-interaction/context-assist/route.ts`
- Modify: any shared type modules and focused tests touched by the split

**Steps:**

- Replace the broad mixed `PromptActionType` with explicitly named boundary types.
- Introduce a dedicated `PersonaInteractionTaskType = "post" | "comment" | "reply"` for public/admin interaction routes.
- Rename the remaining broad union to something like `RuntimeTaskType` or `AiTaskType`.
- Remove any impression that `prompt-builder.ts` is still the active interaction source of truth.
- Keep non-interaction task families working through the renamed cross-feature type.

### Task 2: Delete Internal `taskType -> flow/stage` Helpers

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- Modify: focused tests under `src/lib/ai/prompt-runtime/`

**Steps:**

- Delete `TASK_TYPE_TO_PERSONA_FLOW_STAGE`.
- Delete `resolvePersonaPacketFlowStage()`.
- Change persona runtime packet builders to require explicit `{ flow, stage }`.
- Update call sites so `flow + stage` is resolved before packet-building begins.
- Add focused test coverage proving packet helpers no longer accept `taskType`.

### Task 3: Make Flow Module Or Stage Service The Only Stage Owner

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify if needed: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify if needed: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Modify if needed: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: focused tests

**Steps:**

- Keep public/admin entrypoints on `taskType: "post" | "comment" | "reply"`.
- Resolve `taskType -> flow` only at the boundary.
- Have flow sequencing owners decide the explicit `stage`.
- Ensure no deeper helper re-derives stage from flow or taskType.
- Make `post` public entry independent from any `post_body` shorthand rule.

### Task 4: Rewire Internal Helper Signatures To `flow + stage`

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: any schema/debug/meta helpers touched by the change
- Modify: focused tests

**Steps:**

- Require `{ flow, stage }` in internal prompt/runtime helper inputs.
- Remove any signature that still accepts only `flow` when it really means a stageful execution point.
- Keep `comment_body` and `reply_body` explicit, even though they are currently single-stage flows.
- Re-key any helper lookup or switch logic that still implies `post` means `post_body`.

### Task 5: Hard-Cut Test Helpers And Diagnostics

**Files:**

- Modify: prompt-runtime tests
- Modify: flow-module tests
- Modify: preview/context-assist route tests
- Modify: any test helper modules that still accept mixed shorthands
- Modify: debug/diagnostic helpers if they still surface `taskType` as execution identity

**Steps:**

- Remove `LegacyTestFlow`-style mixed shorthand helpers.
- Make interaction runtime tests pass explicit `{ flow, stage }`.
- Keep public route tests focused on `taskType: "post" | "comment" | "reply"`.
- Ensure interaction debug records and diagnostics assert `flow + stage` identity rather than mixed taskType routing.

### Task 6: Update Active Docs And Trackers

**Files:**

- Modify: `CONTEXT.md`
- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `tasks/todo.md`
- Modify if useful: the prior 2026-05-16 rename plan to note this follow-up hard-cut

**Steps:**

- Document that `Task Type` is a boundary label, not an internal interaction routing key.
- Document that `post` is not shorthand for `post_body`.
- Clarify that active interaction internals use `flow + stage` only.
- Mark the prior rename plan as a predecessor if needed so active readers do not stop at the earlier half-step.

## Verification

Run focused checks after implementation:

```bash
npx vitest run \
  src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts \
  src/lib/ai/agent/execution/flows/post-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/comment-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/reply-flow-module.test.ts \
  src/app/api/admin/ai/persona-interaction/preview/route.test.ts \
  src/app/api/admin/ai/persona-interaction/context-assist/route.test.ts
```

Focused review checks:

- active interaction internals no longer import the mixed broad task-type union
- `TASK_TYPE_TO_PERSONA_FLOW_STAGE` and `resolvePersonaPacketFlowStage()` are gone
- internal interaction helpers all require explicit `flow + stage`
- `post` is never used as implicit `post_body`
- non-interaction families still compile and keep their own task-family contract
- interaction diagnostics identify execution by `flow + stage`

## Risks

- the broad task-type union is currently referenced across prompt-runtime, admin routes, queues, and adapters, so careless renaming could widen the diff beyond the intended interaction boundary cleanup
- if only some helpers migrate to `flow + stage`, the remaining convenience paths will recreate the same ambiguity in a less visible form
- legacy prompt-builder code still carries old planner/writer language; if not clearly downgraded, future work may keep importing it into active interaction runtime

## Suggested Execution Order

1. Split and rename the broad task-type unions.
2. Delete internal `taskType -> flow/stage` helpers.
3. Make stage service and flow modules the only stage owners.
4. Rewire packet/contract/budget helpers to explicit `flow + stage`.
5. Hard-cut tests and diagnostics.
6. Update docs and mark the earlier rename plan as predecessor guidance only.
