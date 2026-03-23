# Prompt Assist Two-Stage Assembly Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify prompt-assist so it resolves personality-bearing references first, audits/repairs only that reference JSON, then generates plain text and appends a fixed trailing reference suffix server-side.

**Architecture:** Replace the current internal `{ text, namedReferences }` rewrite contract with a two-stage flow. Stage 1 resolves `namedReferences` as JSON and fails closed through parse + audit + repair. Stage 2 generates plain `text` using the resolved references as grounding. The server assembles the final API success payload by appending a fixed trailing reference clause to the generated text.

**Tech Stack:** Next.js route handlers, TypeScript service modules, Vitest, existing admin AI LLM invocation helpers.

---

### Task 1: Define the new prompt-assist contract in tests

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts`

**Step 1: Write failing tests**

- Add focused tests that assert:
  - reference resolution returns JSON with `namedReferences`
  - text generation returns plain text only
  - final result is assembled as `text` plus a fixed trailing reference suffix
  - reference-resolution audit/repair handles missing or invalid JSON
  - prompt-assist errors still expose top-level `rawText`

**Step 2: Run the focused tests to verify failure**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts
```

### Task 2: Refactor prompt-assist service to two-stage flow

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-prompt-assist-service.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-contract.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-contract.ts`

**Step 1: Replace the old structured rewrite contract**

- Keep Stage 1 as JSON-only:
  - `{"namedReferences":[{"name":"...","type":"..."}]}`
- Parse and audit only the reference JSON.
- Repair only the reference JSON when parse/audit fails.

**Step 2: Generate plain text from resolved references**

- Build a text-only rewrite prompt grounded in the resolved references.
- Keep existing empty/truncation/weak-output protections for the text stage.

**Step 3: Assemble final output**

- Append a fixed trailing reference suffix in app code using the resolved names.
- Return the assembled string through the existing public API.

### Task 3: Remove obsolete prompt-assist logic and align docs

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Step 1: Remove stale docs about internal `{ text, namedReferences }` rewrite output**

- Document the new two-stage contract:
  - reference JSON resolution/audit/repair
  - text-only rewrite
  - server-side trailing reference assembly

**Step 2: Remove stale implementation wording**

- Delete outdated notes that imply rewrite output still returns both `text` and `namedReferences`.

### Task 4: Verify and summarize

**Files:**

- Modify only if needed during cleanup

**Step 1: Run focused verification**

Run:

```bash
npx vitest run src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts src/hooks/admin/usePersonaBatchGeneration.test.ts
```

Run:

```bash
git diff --check -- src/lib/ai/admin/persona-prompt-assist-service.ts src/lib/ai/admin/control-plane-contract.ts src/lib/ai/admin/persona-generation-contract.ts src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts src/hooks/admin/usePersonaBatchGeneration.test.ts docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md tasks/todo.md tasks/lessons.md
```

**Step 2: Summarize the final behavior**

- Explain the new flow in one short section:
  - reference JSON stage
  - text stage
  - final assembled suffix
