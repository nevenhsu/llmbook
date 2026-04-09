# Comment And Reply Flow Modules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Promote top-level post comments and thread replies into first-class shared text flow modules, while keeping both on a single-stage markdown generation path and normalizing notification text generation into the `reply` flow.

**Architecture:** Build on the shared flow-module boundary introduced by the post-flow plan. `comment` and `reply` remain separate flow modules across flow registry, prompt contracts, audits, repairs, preview/runtime docs, and routing. Both flows keep the same final markdown JSON shape and persist into `comments`, but they diverge in context blocks, task instructions, audit criteria, and repair guidance. `notification` stops being described as a comment-path special case and instead routes directly into the `reply` module.

**Tech Stack:** TypeScript, Vitest, existing `prompt-runtime` and shared text execution services, `AiAgentPersonaTaskContextBuilder`, `AiAgentPersonaTaskGenerator`, `AiAgentPersonaTaskExecutor`, `AiAgentPersonaInteractionService`, Supabase persistence.

---

## Preconditions

- Execute after the shared flow-module registry from `plans/ai-agent/llm-flows/post-flow-modules-plan.md` Task 1 is available, or land that boundary first as part of the same branch.
- Do not reintroduce an umbrella `comment` path inside prompt assembly or runtime docs after `reply` becomes first-class.

## Guardrails

- `comment` means only: a new top-level comment on a post.
- `reply` means only: a thread reply to an existing comment.
- `notification` text generation normalizes into `reply`; it does not own a notification-specific prompt branch.
- `comment` and `reply` both stay single-stage for now; do not add planning stages unless a later design pass explicitly approves them.
- `comment` and `reply` share the same final JSON output shape:
  - `markdown`
  - `need_image`
  - `image_prompt`
  - `image_alt`
- In both flows, `[root_post]` must appear immediately after `[board]`.
- `reply` prompt and audit must explicitly forbid a top-level-essay shape.
- `comment` prompt and audit must explicitly require a standalone top-level contribution with net-new value.

## Target Shape

```text
persona task / preview request
  -> resolve `comment` or `reply` flow module
  -> build flow-specific context blocks
  -> single-stage markdown generation
  -> schema validate / repair
  -> flow-specific audit
  -> flow-specific repair
  -> persist comment row
```

Routing rules:

```text
task_type=comment -> comment flow module
task_type=reply -> reply flow module
notification reply task -> reply flow module
```

## Prompt Block Order

### Comment

```text
[task_context]
[board]
[root_post]
[recent_top_level_comments]
```

### Reply

```text
[task_context]
[board]
[root_post]
[source_comment]
[ancestor_comments]
[recent_top_level_comments]
```

## Shared Output Contract

Both `comment` and `reply` return:

```text
Return exactly one JSON object.
markdown: string
need_image: boolean
image_prompt: string | null
image_alt: string | null
```

## Audit Contracts

### Comment Audit

The canonical audit must evaluate:

- `post_relevance`
- `net_new_value`
- `non_repetition_against_recent_comments`
- `standalone_top_level_shape`
- `persona_fit`

### Reply Audit

The canonical audit must evaluate:

- `source_comment_responsiveness`
- `thread_continuity`
- `forward_motion`
- `non_top_level_essay_shape`
- `persona_fit`

Both audits may share the same outer JSON skeleton if useful, but they must remain separately named contracts with flow-specific checks and repair guidance.

## Task 1: Promote `reply` To A First-Class Text Flow Type

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`
- Modify: `src/lib/ai/agent/execution/index.ts`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/agent/execution/execution-preview.test.ts`

**Step 1: Write the failing tests**

- Add prompt-builder coverage proving `reply` is a formal action type, not a comment alias.
- Add context-builder coverage proving top-level comments resolve to `comment` while comment-thread replies resolve to `reply`.
- Add generator/preview coverage proving the resolved flow kind survives through generation and preview surfaces.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/execution-preview.test.ts
```

Expected: failures showing `reply` is not yet treated as a first-class flow/action type.

**Step 3: Write the minimal implementation**

- Expand prompt/runtime types so `reply` is formal across prompt assembly, preview, and runtime budgets.
- Stop normalizing all non-`post` text work into `comment`.
- Ensure the context builder resolves:
  - `comment` for top-level post comments
  - `reply` for thread replies
- Keep persistence result type as `comment`; first-class flow split does not imply a second DB table.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/agent/execution/index.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/execution-preview.test.ts
git commit -m "refactor: promote reply to a first-class text flow"
```

## Task 2: Lock The Comment And Reply Prompt Contracts

**Files:**

- Modify: `plans/ai-agent/operator-console/prompt-block-examples.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Test: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`

**Step 1: Write the failing tests**

- Add prompt-context tests that lock block order:
  - `comment`: `board -> root_post -> recent_top_level_comments`
  - `reply`: `board -> root_post -> source_comment -> ancestor_comments -> recent_top_level_comments`
- Add wording tests:
  - `comment` requires a standalone top-level contribution
  - `reply` requires direct thread response and forbids top-level-essay shape

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-context-builder.test.ts
```

Expected: failures because current reply context still places `source_comment` before `root_post` and flow instructions are not yet fully split.

**Step 3: Write the minimal implementation**

- Update prompt examples so `comment` and `reply` are formally separated in docs.
- Move `[root_post]` directly below `[board]` in both flows.
- Update context-builder task instructions to make:
  - `comment` explicitly standalone and net-new
  - `reply` explicitly thread-responsive and non-essay-like
- Update prompt-assembly docs so `notification` is described as `reply`, not as a comment-path special case.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add plans/ai-agent/operator-console/prompt-block-examples.md docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts
git commit -m "docs: split comment and reply prompt contracts"
```

## Task 3: Add A First-Class `comment_audit` Contract

**Files:**

- Create: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Create: `src/lib/ai/prompt-runtime/comment-flow-audit.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`

**Step 1: Write the failing tests**

- Add audit parser/builder coverage for `comment_audit`.
- Lock required checks:
  - `post_relevance`
  - `net_new_value`
  - `non_repetition_against_recent_comments`
  - `standalone_top_level_shape`
  - `persona_fit`
- Add flow-module coverage that `comment` failures go through `comment_repair` with comment-specific guidance.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

Expected: failures because comment-specific audit/repair does not exist yet.

**Step 3: Write the minimal implementation**

- Add a dedicated `comment_audit` prompt builder and parser.
- Keep the outer JSON shape concise and machine-checkable.
- Ensure repair guidance focuses on:
  - adding net-new value
  - not echoing recent top-level comments
  - preserving top-level comment shape
- Route `comment` flow-module recheck through the same audit.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/comment-flow-audit.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
git commit -m "feat: add top-level comment audit contract"
```

## Task 4: Add A First-Class `reply_audit` Contract

**Files:**

- Create: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Create: `src/lib/ai/prompt-runtime/reply-flow-audit.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`

**Step 1: Write the failing tests**

- Add audit parser/builder coverage for `reply_audit`.
- Lock required checks:
  - `source_comment_responsiveness`
  - `thread_continuity`
  - `forward_motion`
  - `non_top_level_essay_shape`
  - `persona_fit`
- Add coverage that `notification` text generation and proactive thread replies both route through the same `reply` audit contract.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

Expected: failures because reply-specific audit/repair does not exist yet and notification still behaves like a comment-path special case.

**Step 3: Write the minimal implementation**

- Add a dedicated `reply_audit` prompt builder and parser.
- Make `reply_repair` explicitly preserve thread-local response shape.
- Reject outputs that drift into standalone essay form even if their markdown is otherwise valid.
- Normalize notification reply generation into the same `reply` flow-module and audit path.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/reply-flow-audit.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
git commit -m "feat: add thread reply audit contract"
```

## Task 5: Route Notification And Runtime Docs Onto `reply`

**Files:**

- Modify: `src/lib/ai/README.md`
- Modify: `plans/ai-agent/operator-console/README.md`
- Modify: `plans/ai-agent/operator-console/open-questions.md`
- Modify: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-persistence-service.ts`
- Test: `src/lib/ai/agent/execution/persona-task-persistence-service.test.ts`

**Step 1: Write the failing tests**

- Add persistence/routing tests that prove notification-generated text follows the `reply` flow semantics and still persists to `comments` with the correct `parent_id`.
- Add doc-oriented preview tests that expect `reply` wording instead of legacy shared-comment wording where applicable.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts
```

Expected: failures because docs/tests still describe notification text generation as shared comment-path behavior.

**Step 3: Write the minimal implementation**

- Update runtime docs to say:
  - `comment` = top-level post comment
  - `reply` = thread reply
  - `notification` -> `reply`
- Confirm persistence keeps using the same `comments` table and parent linkage logic.
- Remove any remaining wording that implies `notification` reuses a generic shared `comment` branch.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/README.md plans/ai-agent/operator-console/README.md plans/ai-agent/operator-console/open-questions.md src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts
git commit -m "docs: normalize notification text generation to reply"
```

## Task 6: Final Verification

**Files:**

- Verify only; no new files.

**Step 1: Run targeted tests**

```bash
npm test -- src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS.

**Step 2: Run targeted lint**

```bash
npx eslint src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts src/lib/ai/prompt-runtime/comment-flow-audit.ts src/lib/ai/prompt-runtime/reply-flow-audit.ts src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/agent/execution/persona-task-persistence-service.ts src/lib/ai/agent/execution/flows/comment-flow-module.ts src/lib/ai/agent/execution/flows/reply-flow-module.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS.

**Step 3: Run filtered TypeScript**

```bash
npx tsc --noEmit 2>&1 | rg "src/lib/ai/prompt-runtime/prompt-builder|src/lib/ai/prompt-runtime/runtime-budgets|src/lib/ai/prompt-runtime/comment-flow-audit|src/lib/ai/prompt-runtime/reply-flow-audit|src/lib/ai/agent/execution/persona-task-context-builder|src/lib/ai/agent/execution/persona-task-generator|src/lib/ai/agent/execution/execution-preview|src/lib/ai/agent/execution/persona-interaction-service|src/lib/ai/agent/execution/persona-task-persistence-service|src/lib/ai/agent/execution/flows/comment-flow-module|src/lib/ai/agent/execution/flows/reply-flow-module|src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts"
```

Expected: no matches for touched files.
