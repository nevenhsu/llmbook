# Action Output Contract Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement action-specific prompt/output contracts for markdown generation (`post`, `comment`) and structured decisions (`vote`, `poll_post`, `poll_vote`), including target context injection and structured image request handling.

**Architecture:** Keep one shared prompt assembly pipeline, but make `target_context` and `output_constraints` depend on action type. Markdown-producing tasks return markdown plus structured image request fields; decision tasks return strictly structured payloads. Runtime parsing and preview assembly must use the same contract.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, shared prompt builder, runtime orchestrators

---

### Task 1: Update prompt contract documentation

**Files:**

- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `src/lib/ai/README.md`
- Modify: `src/agents/phase-1-reply-vote/README.md`

**Step 1: Write the failing expectation (doc diff)**

- Document `target_context` as a formal block.
- Replace generic `output_constraints` wording with action-specific contracts.
- Document structured image request fields for `post` and `comment`.
- Document structured decision outputs for `vote`, `poll_post`, and `poll_vote`.

**Step 2: Inspect existing doc text**

Run: `rg -n "output_constraints|task_context|reply|vote|poll|image" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md src/agents/phase-1-reply-vote/README.md`
Expected: docs still describe a generic contract

**Step 3: Write minimal documentation changes**

- Add action-specific tables or sections.
- Keep terminology aligned across docs.

**Step 4: Verify docs**

Run: `rg -n "target_context|poll_vote|poll_post|need_image|image_prompt|image_alt" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md src/agents/phase-1-reply-vote/README.md`
Expected: all new contract terms appear

### Task 2: Extend shared prompt builder for action-specific output constraints

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`

**Step 1: Write failing tests**

- Add tests for `post`, `comment`, `vote`, `poll_post`, and `poll_vote`.
- Assert block order contains `target_context`.
- Assert each action type produces the expected `output_constraints`.

**Step 2: Run tests to confirm failure**

Run: `npx vitest run 'src/lib/ai/prompt-runtime/prompt-builder.test.ts'`
Expected: FAIL because builder is still generic

**Step 3: Implement minimal builder changes**

- Add `actionType` input.
- Add `targetContextText` input.
- Generate action-specific `output_constraints`.
- Preserve explicit empty fallback for missing target context.

**Step 4: Re-run tests**

Run: `npx vitest run 'src/lib/ai/prompt-runtime/prompt-builder.test.ts'`
Expected: PASS

### Task 3: Extend admin interaction preview contract

**Files:**

- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Test: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write failing tests**

- Add preview payload coverage for action-specific target context.
- Add assertions for vote/poll structured output instructions.
- Add assertions for post/comment image request instructions.

**Step 2: Run tests to confirm failure**

Run: `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts'`
Expected: FAIL because preview store/route only know generic post/comment behavior

**Step 3: Implement minimal preview changes**

- Accept action-specific preview input.
- Normalize target context payloads.
- Build `target_context` and action-specific `output_constraints`.

**Step 4: Re-run tests**

Run: `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts'`
Expected: PASS

### Task 4: Implement runtime support for markdown actions

**Files:**

- Modify: `src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Modify: related post/comment runtime/orchestrator files once identified
- Test: runtime tests for reply/comment behavior

**Step 1: Write failing tests**

- Assert markdown tasks use markdown + structured image request contract.
- Assert image request fields are part of output instructions, not inline URLs.

**Step 2: Run tests to confirm failure**

Run: `npx vitest run 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
Expected: FAIL because output constraints are reply-only generic text

**Step 3: Implement minimal runtime changes**

- Thread `actionType` and `targetContextText` into runtime prompt assembly.
- Use action-specific `output_constraints`.
- Add parser/post-process placeholders for structured image request extraction.

**Step 4: Re-run tests**

Run: `npx vitest run 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
Expected: PASS

### Task 5: Implement runtime support for decision actions

**Files:**

- Modify: vote runtime/orchestrator files once identified
- Modify: poll create/vote runtime/orchestrator files once identified
- Test: targeted vote/poll runtime tests

**Step 1: Write failing tests**

- Assert `vote` requires target metadata and returns structured decision constraints.
- Assert `poll_vote` receives poll option context and returns option selection constraints.
- Assert `poll_post` returns poll creation structure.

**Step 2: Run tests to confirm failure**

Run: `rg -n "vote|poll" src/agents src/lib/ai -g '*test.ts'`
Expected: identify existing coverage or missing tests to add

**Step 3: Implement minimal runtime changes**

- Inject target/poll context into prompt assembly.
- Parse structured decision outputs.
- Keep markdown path separate from decision path.

**Step 4: Re-run targeted tests**

Run: `npx vitest run <targeted vote/poll test files>`
Expected: PASS

### Task 6: Add image job integration boundary

**Files:**

- Modify: image-job runtime files once identified
- Modify: post/comment post-processing files once identified
- Test: targeted image contract tests

**Step 1: Write failing tests**

- Assert `need_image=true` triggers image job creation boundary.
- Assert final markdown insertion happens in backend post-processing, not model output.

**Step 2: Run tests to confirm failure**

Run: `rg -n "image job|need_image|image_prompt|image_alt" src -g '*test.ts'`
Expected: identify missing coverage

**Step 3: Implement minimal integration**

- Add contract parser for structured image request.
- Connect to existing or newly introduced image job boundary.

**Step 4: Re-run targeted tests**

Run: `npx vitest run <image contract test files>`
Expected: PASS

### Task 7: Verify integrated behavior

**Files:**

- Modify: `tasks/todo.md`

**Step 1: Run combined verification**

Run: `npx vitest run <all touched test files>`
Expected: PASS

**Step 2: Run focused type validation**

Run: `npx tsc --noEmit --pretty false 2>&1 | rg -n "prompt-builder|persona-interaction/preview|reply-prompt-runtime|vote|poll|image_prompt|target_context"`
Expected: no new errors in touched areas

**Step 3: Update review log**

- Record summary, commands, and results in `tasks/todo.md`.

**Step 4: Commit**

```bash
git add docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md \
  src/lib/ai/README.md \
  src/agents/phase-1-reply-vote/README.md \
  src/lib/ai/prompt-runtime/prompt-builder.ts \
  src/lib/ai/prompt-runtime/prompt-builder.test.ts \
  src/app/api/admin/ai/persona-interaction/preview/route.ts \
  src/lib/ai/admin/control-plane-store.ts \
  tasks/todo.md
git commit -m "feat: add action-specific output contracts"
```
