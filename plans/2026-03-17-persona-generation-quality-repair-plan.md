# Persona Generation Quality Repair Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve `Generate Persona` so staged output not only parses as valid JSON, but also produces natural-language persona contracts that actually match the requested behavior.

**Architecture:** Keep the existing five-stage persona-generation pipeline and its per-stage JSON/schema repair path. Add a second per-stage quality layer for the stages that define persona behavior, with explicit prompt-contract wording, parser validation against machine-label drift, and an optional stage-local quality repair retry before the next stage consumes the output.

**Tech Stack:** Next.js, TypeScript, Vitest, admin control plane store, staged LLM prompt assembly, canonical `persona_core` persistence.

---

## Scope

This plan covers six linked workstreams:

1. Tighten stage contracts so style-heavy fields must be natural-language behavioral descriptions
2. Keep existing stage-level schema repair, but separate it clearly from quality repair
3. Add stage-local quality validation and repair for behavior-heavy stages
4. Improve preview/template/mock visibility so operators can see the upgraded contracts
5. Add focused regression tests for machine-label drift and quality repair behavior
6. Refresh docs, tasks, and lessons

## Non-Goals

- No whole-persona global repair layer after all five stages
- No provider-specific budget logic
- No fallback that silently accepts machine-label quality drift into saved personas
- No interaction-preview persona audit changes unless required by shared helper reuse

## Success Criteria

- `Generate Persona` still retries invalid/incomplete JSON per stage exactly as today
- `interaction_and_guardrails` stops accepting enum-like outputs such as `impulsive_challenge` or `bold_declaration`
- `voice_fingerprint` and `task_style_matrix` become natural-language reusable style instructions instead of machine tokens
- Preview failures can distinguish schema/JSON failure from quality-contract failure
- Canonical docs explain the difference between stage schema repair and stage quality repair

---

## Current State

The staged pipeline in `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts` already performs per-stage repair:

1. Initial stage attempt
2. Shorter `retry_repair` attempt when parse fails
3. Compact `retry_repair` attempt when parse still fails

That logic is correct for JSON/schema failures, but it does not address quality drift. A response can parse successfully while still being weak persona data, especially in Stage 4:

- `interaction_defaults.default_stance: "impulsive_challenge"`
- `voice_fingerprint.opening_move: "hearty_laugh_or_yell"`
- `task_style_matrix.post.entry_shape: "bold_declaration"`

These values satisfy the current parsers but are too machine-like to reliably shape runtime behavior.

---

## Proposed Design

### Layer 1: Stage Schema Repair

Keep the existing repair path unchanged in principle:

1. Attempt normal generation
2. If JSON/schema parse fails, retry with a shorter repair prompt
3. If parse still fails, retry once with a compact repair prompt

This layer remains responsible only for:

- empty output
- invalid JSON
- missing required keys
- wrong scalar/array/object shape

### Layer 2: Stage Quality Validation and Repair

Add a second stage-local pass after schema parsing succeeds for behavior-heavy stages.

Quality validation should initially apply to:

- `values_and_aesthetic`
- `interaction_and_guardrails`

`seed`, `context_and_affinity`, and `memories` can stay schema-only for now unless evidence shows repeated quality drift there.

Quality validation checks should reject:

- enum-like snake_case labels in style fields
- terse taxonomy labels that read like internal constants instead of reusable persona instructions
- stage 4 output that does not describe how the persona opens, attacks, praises, closes, or structures `post` / `comment` in natural language

If quality validation fails:

1. Reuse the parsed stage output as context
2. Ask the model to regenerate only that stage in a quality-repair prompt
3. Re-parse and re-run quality validation once
4. If it still fails, abort the preview/save path with a clear stage-specific failure

This keeps repair scoped to a single stage and prevents one weak stage from poisoning the validated context passed into later stages.

---

## Contract Changes

The main prompt change is in Stage 4.

Current contract only specifies required keys. It should additionally require natural-language behavioral descriptions.

### Stage 4 contract additions

Add wording such as:

- Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.
- Do not output snake_case or identifier-style values like `impulsive_challenge`, `bold_declaration`, or `loyal_defense`.
- Every string should read like reusable persona instruction text that another prompt can directly consume.
- `voice_fingerprint` must describe how the persona opens, attacks, praises, closes, and what shapes it avoids.
- `task_style_matrix.post/comment` must describe how each task should sound and be structured, not just name a category.

### Stage 2 contract additions

Add lighter wording such as:

- Values and aesthetic strings should be written as natural-language preferences or pressures, not keyword bundles.
- Avoid label-like outputs that read like tags instead of persona guidance.

---

## Failure Model

Add explicit persona-generation quality failure types for admin preview/save flows.

Recommended failure codes:

- `persona_generation_stage_parse_failed`
- `persona_generation_stage_quality_failed`
- `persona_generation_stage_quality_repair_failed`

Each should include:

- `stageName`
- `message`
- `rawOutput`
- when relevant, a short `issues` array

This lets admin distinguish:

- JSON was broken
- JSON was valid but style contract was weak
- quality repair still did not produce acceptable persona data

---

### Task 1: Tighten Stage Contracts and Template Preview

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-mock.json`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts`

**Intent:**
Make the prompt contract itself push the model toward natural-language persona guidance before validation has to reject anything.

**Implementation Notes:**

- Expand Stage 2 and Stage 4 contract text with anti-enum / natural-language wording.
- Keep the same five stages and same high-level contracts.
- Sync `View Prompt` template and preview mock output so operators see the updated contract, not stale wording.

**Verification:**

- Mock preview tests assert the new contract wording appears in Stage 2 and Stage 4.

---

### Task 2: Add Stage Quality Validators for Behavior-Heavy Fields

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:**
Reject parsed persona outputs that are structurally valid but too machine-like to act as good canonical persona data.

**Implementation Notes:**

- Add focused validators for:
  - `values.value_hierarchy[*].value`
  - `interaction_defaults.*`
  - `voice_fingerprint.*`
  - `task_style_matrix.post.*`
  - `task_style_matrix.comment.*`
- Prefer lightweight heuristics:
  - reject identifier-style strings containing `_` in human-facing style fields
  - reject strings that are too short to be instruction-like
  - allow reference names and legit domain phrases where appropriate
- Keep validation local to persona generation; do not leak these heuristics into runtime interaction audit.

**Verification:**

- Tests fail when Stage 4 uses values like `impulsive_challenge`, `bold_declaration`, `challenge_or_battle_cry`.
- Tests pass for natural-language replacements.

---

### Task 3: Add Stage-Local Quality Repair

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-token-budgets.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:**
Repair weak persona-contract output without rerunning the entire five-stage generation flow.

**Implementation Notes:**

- Extend `runPersonaGenerationStage()` with a quality-validation hook after parse success.
- On quality failure, run one quality-repair prompt for that stage only.
- The quality-repair prompt should:
  - include the parsed stage output
  - list the quality issues
  - instruct the model to rewrite only the weak fields in natural language
  - preserve the same schema
- Keep this to one extra retry to avoid stage explosion.
- Add a dedicated quality-repair budget cap rather than reusing the parse-repair cap blindly.

**Verification:**

- Tests cover:
  - parse success + quality failure -> quality repair succeeds
  - parse success + quality repair still bad -> stage fails clearly

---

### Task 4: Surface Stage Quality Failures in Admin API

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/preview/route.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/preview/route.test.ts`

**Intent:**
Expose quality-repair failures to the admin caller instead of collapsing them into generic preview errors.

**Implementation Notes:**

- Thread stage-specific failure codes and details through the preview route.
- Include `stageName`, `message`, `rawOutput`, and `issues` in the error payload.
- Keep HTTP semantics aligned with existing admin preview failures.

**Verification:**

- Route tests assert a Stage 4 quality failure returns the typed failure payload.

---

### Task 5: Refresh Canonical Persona Fixtures and Review Surface

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaGenerationPreviewSurface.tsx`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-mock.json`
- Test: `/Users/neven/Documents/projects/llmbook/src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts`

**Intent:**
Ensure the review surface makes the quality change obvious to operators.

**Implementation Notes:**

- Update the mock persona so Stage 4 fields show natural-language guidance, not machine labels.
- If the preview surface already shows structured JSON only, keep that, but ensure the fixture demonstrates the intended contract quality.
- No UI redesign required.

**Verification:**

- Mock page test confirms Stage 4 preview includes natural-language `voice_fingerprint` and `task_style_matrix` values.

---

### Task 6: Docs, Tasks, and Lessons

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Intent:**
Document the distinction between stage schema repair and stage quality repair, and prevent future regressions back to enum-like persona contracts.

**Implementation Notes:**

- Document that `Generate Persona` now has two repair layers:
  - schema/JSON repair
  - quality repair for behavior-heavy stages
- Add a lesson that persisted persona style fields must be natural-language reusable instructions, not machine labels.

**Verification:**

- `git diff --check -- <touched docs/tasks>`
- repo search confirms docs mention stage quality repair where relevant

---

## Recommended Execution Order

1. Task 1 first
2. Task 2 second
3. Task 3 third
4. Task 4 fourth
5. Task 5 fifth
6. Task 6 last

Reason:

- Prompt contract should improve before validation starts rejecting outputs
- Validation needs to exist before quality repair has anything objective to act on
- API/docs should reflect the real failure model after implementation settles

## Verification Checklist

- `npx vitest run src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts src/components/admin/control-plane/PersonaGenerationPreviewMockPage.test.ts`
- `git diff --check`

## Open Decision Already Resolved

- Yes, the fix should change the persona-generation prompts.
- But prompt wording alone is not enough; Stage 4 also needs validation and stage-local quality repair so weak machine-label outputs do not become canonical persona data.
