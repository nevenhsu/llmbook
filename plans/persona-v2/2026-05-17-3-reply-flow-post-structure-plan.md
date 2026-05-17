# 3. Reply Flow Post-Structure Plan

**Goal:** Refactor `reply` so it mirrors the current `post` ownership structure: a dedicated prompt-runtime folder owns prompt-visible block content and renderers, `buildPersonaPromptFamilyV2()` delegates to it, and `reply-flow-module.ts` absorbs its own orchestration instead of hiding behind `single-stage-writer-flow.ts`.

**Architecture:** Preserve flow name `reply` and stage name `reply_body`. Move prompt-visible `task_context`, `target_context`, output-contract text, and block content ownership into `src/lib/ai/prompt-runtime/reply/reply-prompt-builder.ts`. Keep `persona-task-context-builder.ts` responsible for source loading, ancestor traversal, truncation, and typed data preparation only.

**Tech Stack:** TypeScript, Vitest, `buildPersonaPromptFamilyV2()`, `persona-v2-flow-contracts.ts`, `persona-task-context-builder.ts`, `reply-flow-module.ts`.

---

## Resolved Decisions

- This is structural only; prompt copy can be refined later.
- Mirror the current `post` module structure, not just the folder layout.
- Keep `reply` as the flow family and `reply_body` as the internal stage.
- The block order shape should match `post`, but live in a reply-owned constant/helper.
- Prompt-visible `target_context` rendering belongs in the new reply prompt-runtime module.
- `reply-flow-module.ts` should absorb orchestration directly.
- Notification-driven thread text should be described and routed as `reply`, never `comment`.
- No inline `reply` prompt-policy text should remain in `persona-v2-prompt-family.ts` after the refactor.

## Non-Goals

- Do not rename `reply_body`.
- Do not rewrite final prompt wording beyond structurally moving current content.
- Do not preserve `single-stage-writer-flow.ts` as reply’s main owner.
- Do not change persistence semantics for replies beyond the existing `reply` flow boundary.

## Target Shape

```text
src/lib/ai/prompt-runtime/reply/
  reply-prompt-builder.ts
  reply-prompt-builder.test.ts
```

Recommended surface:

```ts
export type CanonicalReplyStage = "reply_body";

export type CanonicalReplyRootPost = { ... };
export type CanonicalReplySourceComment = { ... };
export type CanonicalReplyAncestorComment = { ... };
export type CanonicalReplyRecentTopLevelComment = { ... };

export const REPLY_PROMPT_BLOCK_ORDER = [ ... ] as const;

export function getReplyPromptBlockOrder(): readonly ReplyPromptBlockName[];
export function buildReplyStageTaskContext(...): string;
export function renderReplyTargetContext(...): string;
export function buildReplyStageOutputContract(...): string;
export function buildReplyStageAntiGenericContract(...): string;
export function buildReplyOwnedPromptBlockContent(...): Record<...>;
```

## Task 1: Add The Canonical Reply Prompt-Runtime Owner

**Files:**

- Add: `src/lib/ai/prompt-runtime/reply/reply-prompt-builder.ts`
- Add: `src/lib/ai/prompt-runtime/reply/reply-prompt-builder.test.ts`

**Steps:**

- Create the new `prompt-runtime/reply` folder.
- Add narrow flow-owned prompt-render input types instead of depending on task-context-builder source row shapes directly.
- Add a reply-owned block-order constant/helper parallel to `post`.
- Move reply-stage prompt-visible ownership into this module:
  - `action_mode_policy`
  - `content_mode_policy`
  - `task_context`
  - `schema_guidance`
  - `internal_process`
  - `output_contract`
  - `anti_generic_contract`
  - prompt-visible `target_context` rendering for `[root_post]`, `[source_comment]`, `[ancestor_comments]`, and `[recent_top_level_comments]`
- Keep prompt behavior as close as practical to the current live contract while moving structure.

## Task 2: Delegate Reply Prompt Ownership From Shared V2 Family / Contracts

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`

**Steps:**

- Import the new reply builder into the shared V2 family.
- Route `flow: "reply"` + `stage: "reply_body"` explicitly to reply-owned block content.
- Remove the inline `reply_body` policy/content/placeholder branches from `persona-v2-prompt-family.ts`.
- Delegate reply output-contract prompt text through the new reply builder while leaving code-owned Zod schemas in `persona-v2-flow-contracts.ts`.
- Rewrite focused tests to assert delegated ownership rather than inline prompt text.

## Task 3: Move Reply Prompt-Visible Context Rendering Into Prompt-Runtime

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`

**Steps:**

- Keep source loading, ancestor traversal, excerpt limits, and truncation in the task-context builder.
- Replace inline reply prompt-visible text assembly with calls into the new reply prompt-runtime helpers.
- Build the thread-reply target-context block through reply-owned rendering helpers instead of string assembly in `persona-task-context-builder.ts`.

## Task 4: Absorb Reply Orchestration Directly Into `reply-flow-module.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Modify if needed: `src/lib/ai/agent/execution/flows/types.ts`
- Modify if needed: `src/lib/ai/agent/intake/task-injection-service.ts`

**Steps:**

- Inline or locally own the single-stage reply orchestration path inside `reply-flow-module.ts`.
- Keep flow-specific error classification, regenerate behavior, debug record collection, and parsed result mapping under reply flow ownership.
- Ensure notification-driven thread text still routes through `reply` in code and current docs.
- Do not leave reply runtime ownership hidden in `single-stage-writer-flow.ts`.

## Task 5: Shared Helper Deletion Coordination

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

**Steps:**

- Remove reply’s dependence on `single-stage-writer-flow.ts`.
- Coordinate final deletion once both comment and reply are migrated.

## Verification

```bash
npx vitest run \
  src/lib/ai/prompt-runtime/reply/reply-prompt-builder.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts \
  src/lib/ai/agent/execution/persona-task-context-builder.test.ts \
  src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
git diff --check
```

## Full Related File List

- canonical reply prompt owner:
  - `src/lib/ai/prompt-runtime/reply/reply-prompt-builder.ts`
  - `src/lib/ai/prompt-runtime/reply/reply-prompt-builder.test.ts`
- shared prompt delegation:
  - `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- context rendering owner split:
  - `src/lib/ai/agent/execution/persona-task-context-builder.ts`
  - `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- flow orchestration and routing:
  - `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
  - `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
  - `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
  - `src/lib/ai/agent/intake/task-injection-service.ts`
