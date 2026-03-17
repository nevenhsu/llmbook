# Phase 3 Persona Runtime Optimization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve persona fidelity, runtime stability, and operator visibility in the persona interaction pipeline without changing the persisted persona contract.

**Architecture:** Keep `persona_cores` and `persona_memories` as the only persisted persona truth, but make the runtime path leaner and more explicit by shrinking prompt payloads, deriving task-aware directives, enriching the audit contract, and exposing audit diagnostics in preview. Keep output budgets generous and unified by task/stage rather than splitting by provider.

**Tech Stack:** Next.js, TypeScript, Vitest, shared admin control-plane store, prompt-runtime helpers, React admin preview UI.

---

## Scope

This plan covers five Phase 3 workstreams:

1. Compact persona summary for interaction generation
2. Task-aware persona directives
3. Richer persona audit contract
4. Unified generous task/stage budgets
5. Interaction Preview audit diagnostics

## Non-Goals

- No provider-specific budget branches
- No new DB tables or persisted runtime-derived persona fields
- No “generate in English then translate” flow
- No rewrite of the overall dispatch architecture

## Success Criteria

- Interaction generation prompts become materially smaller without losing persona fidelity
- `post` and `comment` use more appropriate persona directive shapes
- Persona audit returns more actionable structured signals
- Empty/truncated audit failures drop without introducing provider-specific branches
- Admin preview clearly shows whether audit/repair happened and why

---

### Task 1: Compact Persona Summary for Interaction Generation

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/core/runtime-core-profile.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/prompt-builder.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Intent:**
Stop sending the full `agent_core` JSON blob as the primary runtime payload for interaction generation. Keep full persona JSON available for diagnostics, but feed the model a compact, task-relevant persona summary.

**Implementation Notes:**

- Add a derived compact summary shape from `persona_core` for interaction generation.
- For `post`, prioritize:
  - `identity_summary`
  - top `values`
  - `aesthetic_profile`
  - `interaction_defaults`
  - `reference_sources`
- For `comment`, prioritize:
  - `identity_summary`
  - `interaction_defaults`
  - `guardrails`
  - relevant memory
  - `reference_sources`
- Keep the block order stable, but replace oversized `agent_core` content with a compact summary in the generation path.
- Continue exposing full persona data through admin review UI and copy affordances.

**Verification:**

- Prompt-builder tests prove compact summary content is emitted instead of a large raw blob.
- Preview-store tests prove assembled prompts are shorter while still containing persona anchors.

---

### Task 2: Make Persona Directives Task-Aware

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Intent:**
Derive `voiceContract`, `antiStyleRules`, `enactmentRules`, and `inCharacterExamples` differently for `post` vs `comment`.

**Implementation Notes:**

- Extend directive derivation to accept task type.
- `post` should emphasize:
  - strong thesis
  - non-editorial framing
  - anti-listicle pressure
  - reference-role worldview framing
- `comment` should emphasize:
  - immediate reaction
  - sharper stance
  - reply momentum
  - anti-generic helpfulness
- Keep shared templates neutral.
- Avoid task-specific wording leaking into unrelated action types.

**Verification:**

- Unit tests assert `post` and `comment` derive meaningfully different directive sets.
- Preview-store tests assert task-specific directives reach assembled prompts.

---

### Task 3: Enrich Persona Audit Contract

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Intent:**
Make audit results more actionable than simple pass/fail plus generic issues.

**Target Contract Direction:**

- `passes: boolean`
- `issues: string[]`
- `repairGuidance: string[]`
- `severity: "low" | "medium" | "high"`
- `confidence: number`
- `missingSignals: string[]`

**Implementation Notes:**

- Keep the audit response JSON-only.
- Preserve backward-safe parsing only within this active-dev branch if needed for the refactor step, then fully cut over to the richer contract.
- Let repair prompts incorporate `missingSignals` and `severity`.
- Keep audit instructions in English, while still auditing target-language output directly.

**Verification:**

- Unit tests parse valid richer audit payloads and reject malformed ones.
- Store/runtime tests prove repair prompt includes the richer audit guidance.

---

### Task 4: Unify Generous Budgets by Task and Stage

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Consider Create: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Intent:**
Replace scattered magic numbers with one shared generous budget table by task and stage.

**Rules:**

- No provider-specific branching
- Shared generous defaults per task/stage
- `post` gets more headroom than `comment`
- `repair` gets more headroom than `audit`
- compact audit retry remains available as a second-pass fallback

**Implementation Notes:**

- Centralize runtime budget constants.
- Cover:
  - initial generation
  - schema repair
  - persona audit
  - compact persona audit retry
  - persona repair
- Use the same budget source in preview and runtime reply flow where applicable.

**Verification:**

- Tests assert `post` uses larger caps than `comment`.
- Tests assert audit retry uses compact mode and shared budget values.

---

### Task 5: Add Audit Diagnostics to Interaction Preview UI

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PreviewPanel.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/InteractionPreviewModal.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/InteractionPreviewMockPage.tsx`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PreviewPanel.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/InteractionPreviewMockPage.test.ts`

**Intent:**
Make it obvious to operators whether the final preview was original output or the result of repair.

**UI Additions:**

- `Audit Result`
- `Audit Issues`
- `Missing Signals` if available
- `Repair Applied: yes/no`
- `Audit Mode: default/compact`

**Implementation Notes:**

- Keep diagnostics secondary to rendered output.
- Default diagnostics collapsed.
- Do not overwhelm the primary review path.

**Verification:**

- UI tests confirm diagnostics render only when present.
- Preview mocks include both pass-first and repair-after-audit scenarios.

---

### Task 6: Docs and Cleanup

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Intent:**
Keep canonical docs aligned after the runtime contract changes.

**Verification:**

- `git diff --check -- <touched docs>`
- Repo search for stale references to removed audit contract fields or obsolete budget semantics

---

## Recommended Execution Order

1. Task 4 first
2. Task 1 second
3. Task 2 third
4. Task 3 fourth
5. Task 5 fifth
6. Task 6 last

Reason:

- Budget stability reduces noisy failures first
- Compact persona summary reduces prompt pressure before refining directives
- Richer audit becomes more useful once generation prompts are smaller and more task-aware

## Verification Checklist

- Focused Vitest for prompt-runtime helpers
- Focused Vitest for admin interaction preview store/route
- Focused Vitest for runtime reply path
- `git diff --check`
- Repo search for stale architecture wording after docs update

## Open Decision Already Resolved

- Budget strategy: use generous unified budgets by task/stage, not provider-specific branches
