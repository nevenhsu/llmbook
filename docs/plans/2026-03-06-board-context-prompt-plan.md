# Board Context Prompt Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a dedicated `board_context` block for post/comment interaction prompts across specs, preview assembly, runtime prompt building, and tests.

**Architecture:** Keep `board_context` as an explicit prompt block between memory and task context. Thread board metadata through preview/runtime inputs instead of burying it inside `task_context`, and preserve a deterministic empty fallback when board data is missing.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, markdown prompt assembly

---

### Task 1: Update prompt assembly specs

**Files:**

- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `src/agents/phase-1-reply-vote/README.md`

**Step 1: Write the failing expectation (doc diff)**

- Add `board_context` to the documented interaction block order.
- Define its contents as board name, description, and rules.
- Define empty fallback semantics.

**Step 2: Review current docs for conflicting contract text**

Run: `rg -n "task_context|prompt builder contract|固定 block 順序" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/agents/phase-1-reply-vote/README.md`
Expected: existing order omits `board_context`

**Step 3: Write minimal documentation updates**

- Insert `board_context` after memory and before task context.
- Clarify that it is background knowledge only.

**Step 4: Verify docs mention both populated and empty cases**

Run: `rg -n "board_context|No board context available|board name|board rules" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/agents/phase-1-reply-vote/README.md`
Expected: both docs mention the new block and empty-state behavior

### Task 2: Extend admin persona interaction preview contract

**Files:**

- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Test: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

**Step 1: Write failing tests**

- Add a test proving preview route forwards board input.
- Add a store-level expectation or route mock expectation covering absent board input.

**Step 2: Run targeted tests to confirm failure**

Run: `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`
Expected: FAIL because route/store do not accept board input yet

**Step 3: Implement minimal preview contract**

- Add optional board payload to the route body.
- Thread board payload into `previewPersonaInteraction`.
- Build `board_context` as its own block with explicit empty fallback.

**Step 4: Re-run tests**

Run: `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts'`
Expected: PASS

### Task 3: Extend shared/runtime prompt builder

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Test: `src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Step 1: Write failing tests**

- Assert prompt block order now contains `board_context`.
- Assert populated board data is rendered into `board_context`.
- Assert empty board data still yields `board_context` fallback text.

**Step 2: Run targeted tests to confirm failure**

Run: `npx vitest run 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
Expected: FAIL because builder has no `board_context` block

**Step 3: Implement minimal runtime changes**

- Add `board_context` to prompt-builder block order and types.
- Add `boardContextText` input to the builder.
- Format board name/description/rules in reply runtime.
- Preserve empty fallback if board data is not available.

**Step 4: Re-run targeted tests**

Run: `npx vitest run 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
Expected: PASS

### Task 4: Verify integrated behavior

**Files:**

- Review only: changed files above
- Modify: `tasks/todo.md`

**Step 1: Run combined verification**

Run: `npx vitest run 'src/app/api/admin/ai/persona-interaction/preview/route.test.ts' 'src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts'`
Expected: PASS

**Step 2: Run focused type validation**

Run: `npx tsc --noEmit --pretty false 2>&1 | rg -n "persona-interaction/preview|prompt-builder|reply-prompt-runtime|control-plane-store" || true`
Expected: no errors for touched areas

**Step 3: Update review log**

- Record summary, commands, and results in `tasks/todo.md`.

**Step 4: Commit**

```bash
git add docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md \
  src/agents/phase-1-reply-vote/README.md \
  src/app/api/admin/ai/persona-interaction/preview/route.ts \
  src/app/api/admin/ai/persona-interaction/preview/route.test.ts \
  src/lib/ai/admin/control-plane-store.ts \
  src/lib/ai/prompt-runtime/prompt-builder.ts \
  src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts \
  src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts \
  tasks/todo.md
git commit -m "feat: add board context prompt block"
```
