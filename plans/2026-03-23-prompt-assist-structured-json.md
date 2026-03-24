# Prompt Assist Structured JSON Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate admin persona prompt-assist from free-text LLM output to a small structured JSON contract that preserves explicit personality-bearing references reliably.

**Architecture:** Keep the public API success payload unchanged as `{ text }`, but require the internal LLM rewrite/repair stages to return JSON with `text` plus `namedReferences`. Validate that at least one named reference exists, that references are personality-bearing figures rather than anonymous vibes, and that at least one reference is visible in the final text before returning success.

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, existing admin AI service/store contract

---

### Task 1: Lock the new contract with failing tests

**Files:**

- Modify: `src/lib/ai/admin/control-plane-store.persona-prompt-assist.test.ts`
- Modify: `src/app/api/admin/ai/persona-generation/prompt-assist/route.test.ts`

**Steps:**

1. Add regressions for `Leo Tolstoy` and title-only inputs so anonymous free-text output fails and repair must restore a personality-bearing named reference.
2. Verify the new tests fail against the current free-text contract.

### Task 2: Add shared structured parsing/validation for prompt-assist output

**Files:**

- Modify: `src/lib/ai/admin/control-plane-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`

**Steps:**

1. Add prompt-assist structured output types.
2. Add JSON parser/validator for `{ text, namedReferences }`.
3. Keep validation minimal and deterministic:
   - `text` required
   - `namedReferences` required
   - at least one named reference
   - at least one named reference must appear in `text`

### Task 3: Migrate prompt-assist main rewrite, audit, and repair to the JSON contract

**Files:**

- Modify: `src/lib/ai/admin/persona-prompt-assist-service.ts`

**Steps:**

1. Rewrite main prompt instructions to require JSON output.
2. Update empty/weak/truncation/reference repair prompts to return the same JSON contract.
3. Update audit prompts to reason about personality-bearing named references, using original input as grounding.
4. Make audit fail closed on empty/invalid JSON instead of silently passing.

### Task 4: Preserve current external API while improving debug output

**Files:**

- Modify: `src/app/api/admin/ai/persona-generation/prompt-assist/route.ts`

**Steps:**

1. Continue returning `{ text }` on success.
2. On structured-output failures, return canonical debug payloads with the raw LLM result.

### Task 5: Verify, document, and clean up

**Files:**

- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md`

**Steps:**

1. Update spec to describe structured prompt-assist output and personality-bearing named references.
2. Mark plan items complete in `tasks/todo.md`.
3. Capture the reusable lesson about fail-closed semantic audits and structured LLM helper contracts.
