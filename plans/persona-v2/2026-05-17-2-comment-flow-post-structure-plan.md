# 2. Comment Flow Post-Structure Plan

**Goal:** Refactor `comment` so it mirrors the current `post` ownership structure: a dedicated prompt-runtime folder owns prompt-visible block content and renderers, `buildPersonaPromptFamilyV2()` delegates to it, and `comment-flow-module.ts` absorbs its own orchestration instead of hiding behind `single-stage-writer-flow.ts`.

**Architecture:** Preserve flow name `comment` and stage name `comment_body`. Move prompt-visible `task_context`, `target_context`, output-contract text, and block content ownership into `src/lib/ai/prompt-runtime/comment/comment-prompt-builder.ts`. Keep `persona-task-context-builder.ts` responsible for source loading, traversal, truncation, and typed data preparation only.

**Tech Stack:** TypeScript, Vitest, `buildPersonaPromptFamilyV2()`, `persona-v2-flow-contracts.ts`, `persona-task-context-builder.ts`, `comment-flow-module.ts`.

---

## Resolved Decisions

- This is structural only; prompt copy can be refined later.
- Mirror the current `post` module structure, not just the folder layout.
- Keep `comment` as the flow family and `comment_body` as the internal stage.
- The block order shape should match `post`, but live in a comment-owned constant/helper.
- Prompt-visible `target_context` rendering belongs in the new comment prompt-runtime module.
- `comment-flow-module.ts` should absorb orchestration directly.
- No inline `comment` prompt-policy text should remain in `persona-v2-prompt-family.ts` after the refactor.

## Non-Goals

- Do not rename `comment_body`.
- Do not rewrite final prompt wording beyond structurally moving current content.
- Do not preserve `single-stage-writer-flow.ts` as comment’s main owner.
- Do not change persistence semantics for top-level comments.

## Target Shape

```text
src/lib/ai/prompt-runtime/comment/
  comment-prompt-builder.ts
  comment-prompt-builder.test.ts
```

Recommended surface:

```ts
export type CanonicalCommentStage = "comment_body";

export type CanonicalCommentRootPost = { ... };
export type CanonicalRecentTopLevelComment = { ... };

export const COMMENT_PROMPT_BLOCK_ORDER = [ ... ] as const;

export function getCommentPromptBlockOrder(): readonly CommentPromptBlockName[];
export function buildCommentStageTaskContext(...): string;
export function renderCommentTargetContext(...): string;
export function buildCommentStageOutputContract(...): string;
export function buildCommentStageAntiGenericContract(...): string;
export function buildCommentOwnedPromptBlockContent(...): Record<...>;
```

## Task 1: Add The Canonical Comment Prompt-Runtime Owner

**Files:**

- Add: `src/lib/ai/prompt-runtime/comment/comment-prompt-builder.ts`
- Add: `src/lib/ai/prompt-runtime/comment/comment-prompt-builder.test.ts`

**Steps:**

- Create the new `prompt-runtime/comment` folder.
- Add narrow flow-owned prompt-render input types instead of depending on task-context-builder source row shapes directly.
- Add a comment-owned block-order constant/helper parallel to `post`.
- Move comment-stage prompt-visible ownership into this module:
  - `action_mode_policy`
  - `content_mode_policy`
  - `task_context`
  - `schema_guidance`
  - `internal_process`
  - `output_contract`
  - `anti_generic_contract`
  - prompt-visible `target_context` rendering for `[root_post]` plus `[recent_top_level_comments]`
- Keep prompt behavior as close as practical to the current live contract while moving structure.

## Task 2: Delegate Comment Prompt Ownership From Shared V2 Family / Contracts

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`

**Steps:**

- Import the new comment builder into the shared V2 family.
- Route `flow: "comment"` + `stage: "comment_body"` explicitly to comment-owned block content.
- Remove the inline `comment_body` policy/content/placeholder branches from `persona-v2-prompt-family.ts`.
- Delegate comment output-contract prompt text through the new comment builder while leaving code-owned Zod schemas in `persona-v2-flow-contracts.ts`.
- Rewrite focused tests to assert delegated ownership rather than inline prompt text.

## Task 3: Move Comment Prompt-Visible Context Rendering Into Prompt-Runtime

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`

**Steps:**

- Keep source loading, excerpt limits, and truncation in the task-context builder.
- Replace inline comment prompt-visible text assembly with calls into the new comment prompt-runtime helpers.
- Build the top-level comment target-context block through comment-owned rendering helpers instead of string assembly in `persona-task-context-builder.ts`.

## Task 4: Absorb Comment Orchestration Directly Into `comment-flow-module.ts`

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Modify if needed: `src/lib/ai/agent/execution/flows/types.ts`

**Steps:**

- Inline or locally own the single-stage comment orchestration path inside `comment-flow-module.ts`.
- Keep flow-specific error classification, regenerate behavior, debug record collection, and parsed result mapping under comment flow ownership.
- Do not leave comment runtime ownership hidden in `single-stage-writer-flow.ts`.

## Task 5: Shared Helper Deletion Coordination

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`

**Steps:**

- Remove comment’s dependence on `single-stage-writer-flow.ts`.
- Coordinate final deletion in the shared cleanup / reply implementation once both flows are migrated.

## Verification

```bash
npx vitest run \
  src/lib/ai/prompt-runtime/comment/comment-prompt-builder.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts \
  src/lib/ai/agent/execution/persona-task-context-builder.test.ts \
  src/lib/ai/agent/execution/flows/comment-flow-module.test.ts
git diff --check
```

## Full Related File List

- canonical comment prompt owner:
  - `src/lib/ai/prompt-runtime/comment/comment-prompt-builder.ts`
  - `src/lib/ai/prompt-runtime/comment/comment-prompt-builder.test.ts`
- shared prompt delegation:
  - `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
  - `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- context rendering owner split:
  - `src/lib/ai/agent/execution/persona-task-context-builder.ts`
  - `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- flow orchestration:
  - `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
  - `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
  - `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
