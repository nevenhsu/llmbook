# Segmented Persona Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace one-shot persona generation preview with segmented generation and server-side assembly, while keeping the saved canonical persona contract unchanged.

**Architecture:** Break `/api/admin/ai/persona-generation/preview` into five generation stages owned by `AdminAiControlPlaneStore`. Each stage gets its own prompt, parser, retry behavior, and validation; the final assembled payload must still satisfy the canonical `PersonaGenerationStructured` contract before preview returns.

**Tech Stack:** Next.js route handlers, TypeScript, Supabase-backed admin control-plane store, Vitest, JSON prompt contracts.

---

### Task 1: Add staged preview contract tests

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Step 1: Write the failing tests**

Add tests for:

- successful staged assembly into canonical output
- failure in a later stage returning that stage's raw output
- later-stage retry not rerunning successful earlier stages

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL because the store still assumes a one-shot generation path.

**Step 3: Write minimal test fixtures**

Mock `invokeLLM()` with stage-by-stage responses:

- seed
- values/aesthetic
- context/affinity
- interaction/guardrails
- memories

**Step 4: Run test to verify the new failing cases are real**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL on missing staged orchestration.

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
git commit -m "test: add staged persona generation preview coverage"
```

### Task 2: Introduce stage-specific output parsers

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Step 1: Write the failing parser coverage**

Add assertions for:

- seed parser accepts only `personas + identity_summary + references`
- values/aesthetic parser rejects malformed `value_hierarchy`
- memories parser normalizes omitted memories to `[]`

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL because stage parsers do not yet exist.

**Step 3: Write minimal implementation**

Add private parse helpers in `control-plane-store.ts`:

- `parsePersonaSeedOutput()`
- `parsePersonaValuesAndAestheticOutput()`
- `parsePersonaContextAndAffinityOutput()`
- `parsePersonaInteractionOutput()`
- `parsePersonaMemoriesOutput()`

Each should throw `PersonaGenerationParseError` with raw output.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: PASS for parser-focused cases.

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
git commit -m "refactor: add staged persona generation parsers"
```

### Task 3: Replace one-shot preview generation with staged orchestration

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Step 1: Write the failing orchestration test**

Assert that `previewPersonaGeneration()`:

- runs stages in order
- passes prior validated stage output into the next stage prompt
- assembles a final canonical payload

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts -t "staged"
```

Expected: FAIL because preview still uses a single `invokeLLM()` attempt path.

**Step 3: Write minimal implementation**

In `previewPersonaGeneration()`:

- build one prompt block set per stage
- invoke one stage at a time
- validate and normalize after each stage
- keep earlier successful stage outputs in memory
- assemble the final `PersonaGenerationStructured`

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
git commit -m "refactor: stage persona generation preview assembly"
```

### Task 4: Scope retries to individual stages

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Step 1: Write the failing retry tests**

Add tests asserting:

- Stage 3 retry does not rerun Stages 1 and 2
- compact retry is local to the failing stage
- failure after local retries returns that stage's raw output

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts -t "retry"
```

Expected: FAIL because retries are still tied to the one-shot prompt path.

**Step 3: Write minimal implementation**

Extract a reusable stage runner helper:

- input: stage name, prompt, parse function
- behavior: normal attempt, repair attempt, compact retry
- output: validated stage payload

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts -t "retry"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
git commit -m "refactor: scope persona generation retries per stage"
```

### Task 5: Keep route behavior and raw-error surfacing intact

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/preview/route.test.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/preview/route.ts`

**Step 1: Write the failing route test**

Add or update a route test asserting that when Stage 2 or Stage 3 fails, the route still returns:

- `422`
- `error`
- `rawOutput`

with the stage-local parse error.

**Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-generation/preview/route.test.ts
```

Expected: FAIL if route assumptions break during staged refactor.

**Step 3: Write minimal implementation**

Keep route behavior unchanged unless staged parse errors require better stage labeling in the error message.

**Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run src/app/api/admin/ai/persona-generation/preview/route.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/admin/ai/persona-generation/preview/route.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts
git commit -m "test: preserve preview route behavior for staged persona generation"
```

### Task 6: Update operator docs and notes

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`

**Step 1: Document staged persona generation**

Add notes that preview generation is now staged and that save still uses the same assembled canonical payload.

**Step 2: Verify docs reflect the runtime reality**

Run:

```bash
rg -n "one-shot|single call|persona-generation/preview" docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md tasks/todo.md
```

Expected: staged behavior is described, and misleading one-shot wording is removed where necessary.

**Step 3: Commit**

```bash
git add docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md tasks/todo.md
git commit -m "docs: describe staged persona generation preview"
```

### Task 7: Run the focused verification suite

**Files:**

- No code changes required

**Step 1: Run the targeted test suite**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts
```

Expected: PASS

**Step 2: Run diff hygiene**

Run:

```bash
git diff --check -- src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/app/api/admin/ai/persona-generation/preview/route.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md tasks/todo.md
```

Expected: no whitespace or conflict-marker issues

**Step 3: Commit**

```bash
git add src/lib/ai/admin/control-plane-store.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/app/api/admin/ai/persona-generation/preview/route.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/README.md tasks/todo.md
git commit -m "refactor: stage persona generation preview pipeline"
```

Plan complete and saved to `docs/plans/2026-03-13-segmented-persona-generation-plan.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?
