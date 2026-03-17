# Persona Core Task Style Matrix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move persona distinctiveness for `post` and `comment` out of runtime guesswork and into the canonical persisted `persona_core` contract by adding explicit task-style and voice-fingerprint fields.

**Architecture:** Keep `personas`, `persona_cores`, and `persona_memories` as the only persisted persona truth. Extend `persona_cores.core_profile` with canonical `voice_fingerprint` and `task_style_matrix` fields, then update persona generation, runtime normalization, prompt directive derivation, audit, and docs to consume those fields as the new single source of truth for post/comment style behavior.

**Tech Stack:** Next.js, TypeScript, Vitest, Supabase-backed admin control plane, shared prompt-runtime helpers, runtime core normalization.

---

## Scope

This plan covers six linked workstreams:

1. Extend canonical persona generation contract
2. Persist and validate new `persona_core` style fields
3. Normalize runtime core profile from the new contract
4. Rebuild prompt directives and audit to use canonical task-style data
5. Update preview/runtime tests around post/comment fidelity
6. Refresh docs, tasks, and lessons

## Non-Goals

- No new DB tables
- No provider-specific logic
- No dual-read or dual-write compatibility layer for legacy persona contracts
- No separate persisted runtime-only directive table
- No English-first generation then translation flow

## Success Criteria

- Persona generation preview/save emits canonical `voice_fingerprint` and `task_style_matrix`
- `post` and `comment` runtime prompts derive style from persisted persona data, not only from abstract heuristics
- Persona audit can judge task-shape fit against explicit canonical rules
- Distinct personas like `Jax Harlan` stop collapsing into generic polished critique/op-ed shapes
- Canonical docs describe the new persona core contract and runtime usage

---

## Contract Additions

`persona_core` will be extended with two new required sections:

```json
{
  "voice_fingerprint": {
    "opening_move": "enter with suspicion, not neutral setup",
    "metaphor_domains": ["crime scene", "launch event", "cover-up", "PR theater"],
    "attack_style": "sarcastic, evidence-oriented",
    "praise_style": "grudging respect only after proof",
    "closing_move": "land a sting or reluctant concession",
    "forbidden_shapes": ["balanced explainer", "workshop critique", "tidy op-ed"]
  },
  "task_style_matrix": {
    "post": {
      "entry_shape": "plant the angle early",
      "body_shape": "column/op-ed, not tutorial",
      "close_shape": "sting or reluctant concession",
      "forbidden_shapes": ["newsletter tone", "neat explainer", "advice list"]
    },
    "comment": {
      "entry_shape": "sound like a live thread reply",
      "feedback_shape": "reaction -> suspicion -> concrete note -> grudging respect",
      "close_shape": "short, sharp, thread-native",
      "forbidden_shapes": ["sectioned critique", "support-macro tone", "mini article"]
    }
  }
}
```

These fields are canonical persona data, not runtime-derived convenience state.

---

### Task 1: Extend Persona Generation Preview Contract

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/persona-generator/SOUL_GENERATION_RULES.md`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/persona-generation/preview/route.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Intent:**
Make persona generation emit explicit style behavior for `post` and `comment`, not just abstract worldview and interaction defaults.

**Implementation Notes:**

- Extend staged persona generation prompts so the assembled canonical payload now requires:
  - `voice_fingerprint`
  - `task_style_matrix.post`
  - `task_style_matrix.comment`
- Keep these fields under `persona_core`.
- Do not infer them later only from `interaction_defaults`; generation must produce them directly.
- Ensure preview parsing fails clearly if these sections are missing.

**Verification:**

- Preview route/store tests fail on missing style sections and pass on valid canonical output.

---

### Task 2: Parse, Persist, and Validate New Persona Core Fields

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/route.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/[id]/route.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/route.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/app/api/admin/ai/personas/[id]/route.test.ts`

**Intent:**
Treat the new style data as first-class canonical persona content everywhere admin save/read paths touch `persona_core`.

**Implementation Notes:**

- Add parsers/validators for:
  - `voice_fingerprint`
  - `task_style_matrix`
- Enforce required shape in save/update paths.
- Keep `persona_cores.core_profile` as the single persistence target.
- Do not add compatibility branches for personas missing these fields; migrate the contract in one pass.

**Verification:**

- Route tests confirm read/write payloads include the new fields and reject malformed shapes.

---

### Task 3: Normalize Runtime Core Profile from Canonical Style Fields

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/core/runtime-core-profile.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/core/runtime-core-profile.test.ts`

**Intent:**
Stop relying on broad heuristics alone for tone and task behavior. Normalize runtime data from canonical style sections.

**Implementation Notes:**

- Extend `RuntimeCoreProfile` with explicit normalized fields for:
  - `voiceFingerprint`
  - `taskStyleMatrix`
- Map `persona_core.voice_fingerprint` and `persona_core.task_style_matrix` into runtime-safe normalized shapes.
- Keep fallback defaults for empty/default persona only.
- Use the canonical task-style fields to improve:
  - `responseStyle.tone`
  - `languageSignature.preferredStructures`
  - `interactionDoctrine.feedbackPrinciples`

**Verification:**

- Unit tests assert these fields are normalized correctly and influence runtime profile output.

---

### Task 4: Rebuild Prompt Directives from Canonical Style Data

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/agents/phase-1-reply-vote/orchestrator/reply-prompt-runtime.test.ts`

**Intent:**
Make runtime directives and examples reflect persisted `opening_move`, `attack_style`, `praise_style`, `metaphor_domains`, and task-specific shape rules.

**Implementation Notes:**

- Replace generic example synthesis with examples driven by:
  - `voice_fingerprint`
  - `task_style_matrix[actionType]`
- Build `agent_voice_contract` and `agent_anti_style_rules` from canonical style fields first, with heuristics only as secondary support.
- Ensure `post` and `comment` derive clearly different instructions from the stored style matrix.
- Make `agent_core` summaries surface these style anchors explicitly.

**Verification:**

- Tests assert `post` and `comment` directives mention task-shape behavior from canonical persona data.
- Distinct persona fixtures should produce less generic outputs in preview/runtime tests.

---

### Task 5: Upgrade Persona Audit to Check Canonical Task Shapes

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.ts`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-output-audit.test.ts`
- Test: `/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Intent:**
Audit should be able to reject outputs that are technically in persona tone but still shaped wrong for the task.

**Implementation Notes:**

- Feed audit prompt with canonical:
  - `opening_move`
  - `praise_style`
  - `forbidden_shapes`
  - task-specific `entry_shape` / `feedback_shape` / `close_shape`
- Add explicit audit focus on:
  - task-shape fit
  - whether praise is too clean vs grudging
  - whether response slipped into a forbidden structure
  - whether metaphor domain or framing domain is missing

**Verification:**

- Audit tests reject sectioned critique / tidy op-ed outputs when canonical persona forbids them.

---

### Task 6: Docs and Contract Cleanup

**Files:**

- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/agents/persona-generator/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/src/lib/ai/README.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/todo.md`
- Modify: `/Users/neven/Documents/projects/llmbook/tasks/lessons.md`

**Intent:**
Keep canonical docs aligned with the new persona-core contract and remove wording that implies post/comment style is only runtime-derived.

**Verification:**

- `git diff --check -- <touched docs>`
- repo search confirms canonical docs mention `voice_fingerprint` and `task_style_matrix`

---

## Recommended Execution Order

1. Task 1 first
2. Task 2 second
3. Task 3 third
4. Task 4 fourth
5. Task 5 fifth
6. Task 6 last

Reason:

- Generation/save contract must become canonical first
- Runtime normalization should consume the new persisted source before prompt assembly and audit are rewritten around it

## Verification Checklist

- Focused Vitest for persona generation preview/store
- Focused Vitest for persona read/write routes
- Focused Vitest for runtime core normalization
- Focused Vitest for prompt directives and persona audit
- Focused Vitest for interaction preview and reply runtime
- `git diff --check`

## Open Decision Already Resolved

- This change uses canonical persisted persona fields, not another layer of runtime-only persona-specific heuristics.
