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
- `comment.main` and `reply.main` must internally self-check draft fidelity before emitting final JSON.
- That internal self-check must explicitly cover:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- Any `comment` or `reply` audit/repair step that judges doctrine fit must receive compact persona evidence from canonical persona fields. At minimum this includes `reference_sources` names plus a derived thread-writing lens.
- `comment` and `reply` audits consume compact review packets; repairs consume fuller rewrite packets.
- Audit prompts must know the packet is intentionally compact and must not fail just because omitted generation context is absent.
- `comment` and `reply` output constraints must align with `post_body` on the shared writer media tail:
  - `need_image`
  - `image_prompt`
  - `image_alt`

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

## Shared Registry Boundary

This plan inherits the shared registry boundary from [post-flow-modules-plan.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/llm-flows/post-flow-modules-plan.md).

For `comment` and `reply`, the important rule is:

- the registry unifies how callers enter a flow
- it does not erase the semantic difference between top-level comments and thread replies

`comment` and `reply` therefore keep separate prompt contracts, audits, and repairs while still returning through the same outer flow-result envelope.

Routing rules:

```text
task_type=comment -> comment flow module
task_type=reply -> reply flow module
notification reply task -> reply flow module
```

## Result Envelope Alignment

`comment` and `reply` should use the same discriminated outer envelope introduced by the shared registry design.

Recommended result members:

```ts
type CommentFlowResult = {
  flowKind: "comment";
  parsed: {
    comment: CommentOutput;
  };
  diagnostics: FlowDiagnostics;
};

type ReplyFlowResult = {
  flowKind: "reply";
  parsed: {
    reply: ReplyOutput;
  };
  diagnostics: FlowDiagnostics;
};
```

Rules:

- callers branch on `flowKind`, not on `markdown` field presence
- `comment` and `reply` keep separate parsed payload labels even though their output schema is similar
- notification-triggered replies still return `flowKind: "reply"`

## `FlowDiagnostics` Alignment

`comment` and `reply` should reuse the same minimum `FlowDiagnostics` contract defined in [post-flow-modules-plan.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/llm-flows/post-flow-modules-plan.md).

Alignment rules:

- keep `finalStatus`, `terminalStage`, `attempts`, and `stageResults`
- keep attempt counters per-stage; do not merge retries into one cross-flow total
- do not invent a second comment-specific diagnostics skeleton
- omit `gate` because `comment` and `reply` do not run candidate selection

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

This matches the shared writer-output pattern used by `post_body`, except `comment`/`reply` do not carry `tags`.

## Attempt Budget

`comment` and `reply` mirror the `post` attempt policy where it applies, but without planning-specific stages.

- initial main generation: 1
- `schema_repair`: at most 1 per generation attempt
- flow-specific repair (`comment_repair` or `reply_repair`): at most 1 per generation attempt
- fresh regenerate: at most 1 if the initial path still fails after repair/recheck or ends terminally
- after the regenerate path exhausts its repair budget, terminal fail

This keeps retry semantics aligned across all shared text flows while preserving their simpler single-stage structure.

## Audit Contracts

### Comment Audit

The canonical audit must evaluate:

- `post_relevance`
- `net_new_value`
- `non_repetition_against_recent_comments`
- `standalone_top_level_shape`
- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

### Reply Audit

The canonical audit must evaluate:

- `source_comment_responsiveness`
- `thread_continuity`
- `forward_motion`
- `non_top_level_essay_shape`
- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

Both audits may share the same outer JSON skeleton if useful, but they must remain separately named contracts with flow-specific checks and repair guidance.

Both audits also require compact persona evidence. Board/post/thread context alone is not enough to judge persona fit reliably.

For persona fidelity, both `comment_audit` and `reply_audit` should explicitly judge:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

Recommended owner:

- one shared `buildPersonaEvidence()` helper in the prompt-runtime persona projection layer
- do not let `comment` and `reply` assemble separate ad hoc persona-fit blocks

Packet rule:

- audits keep the full generated `markdown` under review
- surrounding board/post/thread context should be compacted to only what the declared checks need
- repairs receive the previous output plus fuller thread/post context, audit issues, and repair guidance
- audit prompts must be told not to treat intentionally omitted background as a failure by itself

## Writer Doctrine Rule

`comment` and `reply` should not wait for external audit to discover that the text "sounds wrong".

Their main prompts should instruct the model to internally test the draft before output:

- `value_fit`
  - does the draft care about the right things in the right order
- `reasoning_fit`
  - does the draft respond to the thread/post through the persona's actual judgment logic
- `discourse_fit`
  - does the draft take the right discussion shape for this flow
- `expression_fit`
  - does the language pressure feel like this persona rather than generic assistant prose

This internal self-check is silent. It should revise the draft before the final JSON output, not produce extra fields or chain-of-thought.

## Task 1: Promote `reply` To A First-Class Text Flow Type ✅ DONE

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

## Task 2: Lock The Comment And Reply Prompt Contracts ✅ DONE

**Files:**

- Modify: `plans/ai-agent/llm-flows/prompt-block-examples.md`
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
git add plans/ai-agent/llm-flows/prompt-block-examples.md docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts
git commit -m "docs: split comment and reply prompt contracts"
```

## Task 3: Add A First-Class `comment_audit` Contract ✅ DONE

> **Status:** Completed, including flow-module audit/repair loop wiring and four-dimensional doctrine checks.

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
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
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
- Feed `comment_audit` and `comment_repair` a compact persona-evidence block so persona-fit judgments are grounded in canonical persona data.
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

## Task 4: Add A First-Class `reply_audit` Contract ✅ DONE

> **Status:** Completed, including flow-module audit/repair loop wiring and four-dimensional doctrine checks.

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
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- Add coverage that `notification` text generation and proactive thread replies both route through the same `reply` audit contract.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts
```

Expected: failures because reply-specific audit/repair does not exist yet and notification still behaves like a comment-path special case.

**Step 3: Write the minimal implementation**

- Add a dedicated `reply_audit` prompt builder and parser.
- Feed `reply_audit` and `reply_repair` a compact persona-evidence block so persona-fit judgments are grounded in canonical persona data.
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

## Task 5: Route Notification And Runtime Docs Onto `reply` ✅ DONE

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

## Task 6: Final Verification ✅ DONE

> **Status:** Completed.

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

**Step 3: Run project typecheck**

```bash
npm run typecheck
```

Expected: PASS.
