# Persona Generation Relationship Removal Plan

> **Status:** Historical cleanup note. The active generate-persona implementation target is [persona-generation-contract.md](/Users/neven/Documents/projects/llmbook/docs/ai-agent/llm-flows/persona-generation-contract.md). Use this document only to identify stale relationship-oriented fields/wording that still need deletion during the simplification migration.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Capture the stale relationship-oriented fields, wording, and runtime assumptions that must be cleaned up while migrating generate-persona to the simplified `seed -> persona_core` contract.

**Architecture:** Use the simplification plan as the canonical migration target, but keep this note as a cleanup checklist for deleting relationship-oriented semantics from remaining runtime/profile/prompt code. Keep the existing `interaction_defaults` container name where it still exists in active schemas, but remove runtime/profile/prompt code that still derives or expects relationship-oriented fields. This is a latest-contract cleanup, not a compatibility layer.

**Tech Stack:** TypeScript, Vitest, admin control-plane staged JSON generation, runtime core-profile normalization, prompt-runtime persona directives, admin preview UI/docs.

---

## Core Decision

Generate Persona will no longer produce relationship-coded output as part of the canonical persona payload, and active runtime/prompt code should not preserve relationship fields as passive compatibility data.

The current relationship lineage is:

- generate-persona stage emits `interaction_defaults.default_stance`
- generate-persona stage emits `interaction_defaults.friction_triggers`
- runtime-core-profile derives `relationshipTendencies`
- prompt/runtime/admin preview still carry relationship-oriented assumptions

That lineage will be removed.

The new canonical direction is:

- keep a discussion-behavior stage
- keep `interaction_defaults` as the discussion-behavior container
- keep `guardrails`
- keep `voice_fingerprint`
- keep `task_style_matrix`
- remove downstream `relationshipTendencies` expectations from runtime prompt projection

## Target Contract

Current stage payload:

```text
interaction_defaults{
  default_stance,
  discussion_strengths,
  friction_triggers,
  non_generic_traits
}
```

Target stage payload:

```text
interaction_defaults{
  default_stance,
  discussion_strengths,
  friction_triggers,
  non_generic_traits
}
```

Notes:

- Keep the existing `interaction_defaults` object name to minimize migration cost.
- Keep `default_stance`, but redefine and audit it as discussion posture, not relationship posture.
- Keep `discussion_strengths` because it is still useful writer/planner guidance.
- Keep `friction_triggers`, but treat it as discussion-friction guidance rather than relationship theory.
- Keep `non_generic_traits` because it is a good source for enactment rules.
- The stage may keep the existing internal name `interaction_and_guardrails`; only the semantics tighten, not the container name.

## Guardrails

- Do not rename the container to a new top-level key unless a later design proves the existing `interaction_defaults` shape is structurally insufficient.
- Do not preserve `relationshipTendencies` as a passive prompt/runtime contract once this migration lands.
- Do not reintroduce `agent_relationship_context` while implementing this plan.
- Do not let preview/mock/docs continue showing relationship-oriented wording after the contract changes.
- Keep generate-persona output focused on reusable persona guidance, not interpersonal-theory metadata.

## Task 1: Tighten The Persona-Generation Stage Semantics

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Test: `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- Test: `src/lib/ai/admin/persona-generation-contract.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`

**Step 1: Write the failing tests**

- Add coverage that the prompt template for `interaction_and_guardrails` still asks for `interaction_defaults`, not a renamed top-level object.
- Add coverage that stage instructions describe `default_stance` and `friction_triggers` as discussion behavior, not relationship posture.
- Add coverage that parser/validator continues accepting the canonical `interaction_defaults` object.
- Add coverage that quality validation rejects identifier-style or relationship-theory-style values even when the keys stay the same.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL because the current stage wording still implies relationship-style semantics.

**Step 3: Write the minimal implementation**

- Update stage contract strings in the prompt template and preview service.
- Keep the canonical generated payload under `interaction_defaults`.
- Update stage wording so `default_stance` is explicitly discussion-opening posture rather than relationship stance.
- Update stage quality checks to validate `interaction_defaults.default_stance` as reusable natural-language discussion guidance.
- Remove any quality wording that frames `friction_triggers` as relationship metadata rather than discussion-friction guidance.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/admin/persona-generation-prompt-template.ts src/lib/ai/admin/persona-generation-preview-service.ts src/lib/ai/admin/persona-generation-contract.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
git commit -m "refactor: remove relationship semantics from persona generation"
```

## Task 2: Remove Runtime Relationship Projection From Persona Core Normalization

**Files:**

- Modify: `src/lib/ai/core/runtime-core-profile.ts`
- Test: `src/lib/ai/core/runtime-core-profile.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Step 1: Write the failing tests**

- Add coverage that normalized runtime profile no longer exposes `relationshipTendencies`.
- Add coverage that any derived summary/diagnostic helpers stop emitting `defaultRelationshipStance`.
- Add coverage that prompt directives still use `interaction_defaults`-derived discussion guidance without expecting relationship-derived prompt content.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: FAIL because runtime normalization still derives relationship output from persona core.

**Step 3: Write the minimal implementation**

- Remove `relationshipTendencies` and `defaultRelationshipStance` from the runtime profile shape.
- Re-derive tone/rhythm/enactment inputs from:
  - `interaction_defaults.default_stance`
  - `discussion_strengths`
  - `non_generic_traits`
  - existing `voice_fingerprint` and `task_style_matrix`
- Remove helper text that was only formatting relationship cues for prompt/runtime consumption.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/core/runtime-core-profile.ts src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
git commit -m "refactor: drop runtime relationship projection from persona core"
```

## Task 3: Remove Relationship-Oriented Preview And Fixture Assumptions

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify: `src/components/admin/control-plane/PersonaStructuredPreview.tsx`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Test: `src/lib/ai/admin/persona-save-payload.test.ts`
- Test: `src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts`

**Step 1: Write the failing tests**

- Add coverage that preview fixtures and rendered structured preview still show `interaction_defaults.default_stance`.
- Add coverage that the UI no longer presents these fields as relationship guidance.
- Add coverage that saved payload tests still pass with the migrated `persona_core` semantics.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts
```

Expected: FAIL because preview fixtures/UI still assume the old relationship-oriented wording.

**Step 3: Write the minimal implementation**

- Keep preview fixtures on `interaction_defaults`, but rewrite fixture content to match the non-relationship semantics.
- Update admin structured preview rendering labels and explanatory copy.
- Confirm save/update paths pass through the new `persona_core` payload without trying to restore old relationship framing.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/admin/persona-generation-preview-mock.ts src/components/admin/control-plane/PersonaStructuredPreview.tsx src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts
git commit -m "refactor: update persona preview surfaces for non-relationship interaction defaults"
```

## Task 4: Update Docs And Remove Stale Relationship Language

**Files:**

- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `docs/ai-agent/llm-flows/prompt-block-examples.md`
- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Test/Review: `rg -n "relationshipTendencies|defaultRelationshipStance|agent_relationship_context" docs src/lib/ai/admin src/lib/ai/core plans`

**Step 1: Write the doc/test expectation**

- Identify every remaining doc/example that still presents relationship output as an active contract.
- Decide whether each hit is:
  - current contract and must be rewritten
  - historical note and must be marked as historical
  - unrelated domain usage and should remain

**Step 2: Run the review search**

Run:

```bash
rg -n "relationshipTendencies|defaultRelationshipStance|agent_relationship_context" docs src/lib/ai/admin src/lib/ai/core plans
```

Expected: multiple hits that still describe the retired relationship lineage.

**Step 3: Write the minimal implementation**

- Update control-plane and prompt-assembly docs to clarify that `interaction_defaults` is discussion guidance, not relationship metadata.
- Remove wording that says persona generation must produce relationship guidance or downstream relationship projection.
- Update prompt-block examples so they no longer imply a relationship block or relationship-derived writer contract.
- Leave clearly historical docs marked as historical instead of pretending they are current.

**Step 4: Re-run the review search**

Run the same `rg` command and expect only intentional historical/unrelated hits.

**Step 5: Commit**

```bash
git add docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md docs/ai-agent/llm-flows/prompt-block-examples.md docs/ai-agent/llm-flows/prompt-family-architecture.md
git commit -m "docs: remove relationship lineage from persona generation docs"
```

## Task 5: Final Verification

**Files:**

- Review: `src/lib/ai/admin/persona-generation-contract.ts`
- Review: `src/lib/ai/core/runtime-core-profile.ts`
- Review: `src/components/admin/control-plane/PersonaStructuredPreview.tsx`

**Step 1: Run focused test suite**

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts
```

Expected: PASS.

**Step 2: Run targeted stale-contract search**

Run:

```bash
rg -n "relationshipTendencies|defaultRelationshipStance|agent_relationship_context" src docs plans
```

Expected: only intentional historical or unrelated product-domain hits remain.

**Step 3: Manual review**

- Confirm the latest canonical persona-generation contract still uses `interaction_defaults`.
- Confirm no active prompt/runtime path still expects relationship output from generate-persona.
- Confirm the runtime no longer derives prompt behavior from `relationshipTendencies`.

**Step 4: Commit final cleanup if needed**

```bash
git add -A
git commit -m "chore: finalize persona relationship contract removal"
```
