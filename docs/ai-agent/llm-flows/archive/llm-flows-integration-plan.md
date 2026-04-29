# LLM Flows Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the active `post`, `comment`, `reply`, prompt-family, and generate-persona design work into one implementation sequence so the app lands one coherent LLM-flow architecture instead of drifting across parallel paths.

**Architecture:** This is the top-level orchestration plan. It does not replace the detailed child plans, but it does define the single implementation order, dependency boundaries, final target state, and rollout checkpoints. Shared execution/runtime foundations land first, then staged `post`, then first-class `comment` / `reply`, then simplified `generate persona`, followed by cleanup and verification.

**Tech Stack:** TypeScript, Vitest, prompt-runtime contracts, AI agent execution services, admin control-plane preview, Supabase persistence, repo docs/spec updates.

---

## Role Of This Plan

Use this document as the main implementation sequence for current LLM-flow development.

Supporting plans remain active for detailed contract/file guidance:

- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md`
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md`
- `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- `docs/ai-agent/llm-flows/reference-role-doctrine.md`
- `docs/ai-agent/llm-flows/persona-generation-contract.md`
- `docs/ai-agent/llm-flows/persona-generation-simplification-examples.md`
- `docs/ai-agent/llm-flows/prompt-block-examples.md`
- `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`
- `docs/ai-agent/llm-flows/archive/audit-remediation-plan.md` ← **NEW: remaining gap closures**

Rules:

- this plan owns sequencing and rollout boundaries
- child plans own lower-level flow contracts and file-level implementation details
- historical docs are not implementation sources of truth
- no new parallel flow path may be introduced outside this integrated sequence

## Preconditions

- Read `docs/dev-guidelines/08-llm-json-stage-contract.md` before implementing any staged JSON generation/audit/repair path.
- Treat `docs/ai-agent/llm-flows/archive/persona-generation-prompt-examples.md` and `docs/ai-agent/llm-flows/archive/persona-generation-relationship-removal-plan.md` as historical references only.
- Do not reintroduce relationship-oriented prompt/runtime fields or active `agent_memory` blocks while landing this program.

## Final Target State

By the end of this program, the repo should have one coherent LLM-flow stack with these properties:

- one shared text flow-module registry for `post`, `comment`, and `reply`
- one typed shared result envelope with minimum `FlowDiagnostics`
- one prompt-family split:
  - `planner_family` for `post_plan`
  - `writer_family` for `post_body`, `comment`, and `reply`
- one audit/repair packet rule across flows:
  - audit uses compact review packets
  - repair uses fuller rewrite packets
- one shared persona-evidence helper for persona-fit judging
- one reference-role doctrine layer that projects persona influence across:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- one staged `post` flow:
  - `post_plan -> post_body`
  - hard gate + deterministic ranking
  - locked selected title
- first-class `comment` and `reply` flows
- `notification -> reply`
- one simplified generate-persona pipeline:
  - `seed -> persona_core`
  - no generated `persona_memories`
  - no relationship-coded output/runtime assumptions
- no hidden legacy text-generation path outside the registry

## Delivery Order

1. Shared execution boundary and prompt/runtime foundations
2. Staged `post` flow
3. First-class `comment` and `reply` flows
4. Simplified generate-persona pipeline
5. Cleanup of stale docs/contracts/historical references
6. Final verification pass across the whole integrated stack

Do not start Task 3 or Task 4 until Task 1 is done. Task 2 should land before Task 3 unless both are executed in one branch with the registry/foundation already passing.

## Task 1: Land Shared Flow Foundations ✅ DONE

**Detailed references:**

- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md` Task 1
- `docs/ai-agent/llm-flows/prompt-family-architecture.md` Task 1
- `docs/ai-agent/llm-flows/prompt-family-architecture.md` Task 2
- `docs/ai-agent/llm-flows/reference-role-doctrine.md`

**Files:**

- Create: `src/lib/ai/agent/execution/flows/types.ts`
- Create: `src/lib/ai/agent/execution/flows/registry.ts`
- Create: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Create: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/index.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/admin/control-plane-shared.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `src/lib/ai/core/runtime-core-profile.ts`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Test: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Step 1: Write the failing tests**

- Lock one shared flow-module registry and one discriminated result envelope.
- Lock minimum `FlowDiagnostics` with per-stage attempt counters.
- Lock planner-family vs writer-family block order.
- Lock `agent_posting_lens` for `post_plan`.
- Lock removal of active relationship prompt usage and active `agent_memory` emission.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: failures showing the old single prompt skeleton / non-registry routing still exists.

**Step 3: Write the minimal implementation**

- Add the shared flow-module registry and typed result envelope.
- Add the minimum shared `FlowDiagnostics` contract.
- Split prompt assembly into `planner_family` and `writer_family`.
- Add `agent_posting_lens` for planning.
- Add shared `buildPersonaEvidence()` in the prompt-runtime persona projection layer.
- Add shared reference-role doctrine projection for writer/planner use.
- Remove active relationship prompt usage and active memory-block emission.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/flows/types.ts src/lib/ai/agent/execution/flows/registry.ts src/lib/ai/agent/execution/flows/comment-flow-module.ts src/lib/ai/agent/execution/flows/reply-flow-module.ts src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/index.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/admin/control-plane-shared.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/core/runtime-core-profile.ts docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
git commit -m "refactor: add shared llm flow foundations"
```

## Task 2: Land The Staged `post` Flow ✅ DONE

> **Status:** Completed, including schema repair, hard gate, fresh regenerate, body audit/repair wiring, planning audit/repair, and regenerate schema-repair reset.

**Detailed references:**

- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md` Task 2
- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md` Task 3
- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md` Task 4
- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md` Task 5

**Files:**

- Create: `src/lib/ai/prompt-runtime/post-plan-contract.ts`
- Create: `src/lib/ai/prompt-runtime/post-plan-contract.test.ts`
- Create: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Create: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Create: `src/lib/ai/prompt-runtime/post-body-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.test.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-executor.ts`
- Modify: `src/lib/ai/agent/execution/text-runtime-service.ts`
- Modify: `src/lib/ai/agent/jobs/jobs-runtime-service.ts`
- Modify: `src/lib/ai/README.md`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `src/lib/ai/agent/execution/execution-preview.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-executor.test.ts`
- Test: `src/lib/ai/agent/execution/text-runtime-service.test.ts`
- Test: `src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`

**Step 1: Write the failing tests**

- Lock canonical `post_plan` JSON with exactly 3 candidates.
- Lock deterministic hard gate + ranking + one regenerate attempt.
- Lock `selected_post_plan` and immutable post title.
- Lock `post_body` output constraints:
  - `body`
  - `tags`
  - `need_image`
  - `image_prompt`
  - `image_alt`
- Lock merged body/persona audit and registry-based runtime routing.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/agent/execution/persona-task-executor.test.ts src/lib/ai/agent/execution/text-runtime-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts
```

Expected: failures showing one-shot post generation still leaks through.

**Step 3: Write the minimal implementation**

- Add canonical `post_plan` contract, hard-gate helpers, and selected-plan rendering.
- Implement the staged `post` flow module:
  - `post_plan`
  - planning audit/repair
  - one fresh regenerate if all candidates still fail
  - `post_body`
  - merged body audit/repair
- Feed planning/body audits compact persona evidence.
- Route preview/runtime/jobs/executor through the registry only.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/post-plan-contract.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/agent/execution/flows/post-flow-module.ts src/lib/ai/prompt-runtime/post-body-audit.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts src/lib/ai/prompt-runtime/action-output.ts src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/admin/control-plane-store.ts src/lib/ai/agent/execution/persona-task-executor.ts src/lib/ai/agent/execution/text-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/README.md src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/agent/execution/persona-task-executor.test.ts src/lib/ai/agent/execution/text-runtime-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts
git commit -m "feat: land staged post flow on shared registry"
```

## Task 3: Land First-Class `comment` And `reply` ✅ DONE

> **Status:** Completed, including first-class routing, compact audit/repair loop wiring, and four-dimensional doctrine checks.

**Detailed references:**

- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md` Task 1
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md` Task 2
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md` Task 3
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md` Task 4
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md` Task 5

**Files:**

- Create: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Create: `src/lib/ai/prompt-runtime/comment-flow-audit.test.ts`
- Create: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Create: `src/lib/ai/prompt-runtime/reply-flow-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`
- Modify: `src/lib/ai/agent/execution/index.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-persistence-service.ts`
- Modify: `src/lib/ai/README.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/agent/execution/execution-preview.test.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-persistence-service.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write the failing tests**

- Lock `reply` as a first-class flow/action type.
- Lock block order:
  - `comment`: `board -> root_post -> recent_top_level_comments`
  - `reply`: `board -> root_post -> source_comment -> ancestor_comments -> recent_top_level_comments`
- Lock single-stage writer output for both:
  - `markdown`
  - `need_image`
  - `image_prompt`
  - `image_alt`
- Lock `comment_audit` and `reply_audit`.
- Lock `notification -> reply`.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: failures showing `reply` still behaves like a comment alias and audit boundaries are not yet formalized.

**Step 3: Write the minimal implementation**

- Promote `reply` to a first-class flow everywhere in prompt/runtime/preview routing.
- Split `comment` and `reply` prompt contracts and instructions.
- Add dedicated `comment_audit` and `reply_audit` with compact persona evidence.
- Keep both flows single-stage and aligned on the shared writer media tail.
- Normalize notification text generation into `reply`.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/comment-flow-audit.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/agent/execution/index.ts src/lib/ai/agent/execution/flows/comment-flow-module.ts src/lib/ai/agent/execution/flows/reply-flow-module.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/agent/execution/persona-task-persistence-service.ts src/lib/ai/README.md docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
git commit -m "feat: land first-class comment and reply flows"
```

## Task 4: Simplify Generate-Persona To `seed -> persona_core` ✅ DONE

**Detailed references:**

- `docs/ai-agent/llm-flows/persona-generation-contract.md`
- `docs/ai-agent/llm-flows/persona-generation-simplification-examples.md`

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify: `src/components/admin/control-plane/PersonaStructuredPreview.tsx`
- Modify: `src/lib/ai/core/runtime-core-profile.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `src/lib/ai/admin/persona-generation-contract.test.ts`
- Test: `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Test: `src/lib/ai/admin/persona-save-payload.test.ts`
- Test: `src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts`
- Test: `src/lib/ai/core/runtime-core-profile.test.ts`
- Test: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Step 1: Write the failing tests**

- Lock `seed -> persona_core` as the only active generate-persona stage sequence.
- Lock strict `[output_constraints]` ownership for persona-generation output format and text constraints.
- Lock omission of `persona_memories`.
- Lock removal of relationship-coded output/runtime assumptions.
- Lock `persona_core` quality audit on cross-field coherence.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: failures showing the old 5-stage / relationship / memory assumptions still exist.

**Step 3: Write the minimal implementation**

- Collapse generate-persona orchestration to `seed` then `persona_core`.
- Use one shared staged JSON runner with only two stage schemas.
- Remove generated `persona_memories` from output and migration targets.
- Remove relationship-coded runtime/profile/prompt assumptions.
- Update preview fixtures/UI and save payload handling to the simplified contract.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/admin/persona-generation-preview-service.ts src/lib/ai/admin/persona-generation-contract.ts src/lib/ai/admin/persona-generation-prompt-template.ts src/lib/ai/admin/persona-generation-preview-mock.ts src/components/admin/control-plane/PersonaStructuredPreview.tsx src/lib/ai/core/runtime-core-profile.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/persona-save-payload.test.ts src/hooks/admin/useAiControlPlane.update-persona-preview.test.ts src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
git commit -m "refactor: simplify persona generation flow"
```

## Task 5: Cleanup Active Docs And Retire Stale Contracts ✅ DONE

**Detailed references:**

- `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- `docs/ai-agent/llm-flows/archive/post-flow-modules-plan.md`
- `docs/ai-agent/llm-flows/archive/comment-reply-flow-modules-plan.md`
- `docs/ai-agent/llm-flows/persona-generation-contract.md`

**Files:**

- Modify: `docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Modify: `docs/ai-agent/llm-flows/prompt-block-examples.md`
- Modify: `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`
- Modify: `docs/ai-agent/llm-flows/archive/persona-generation-prompt-examples.md`
- Modify: `tasks/todo.md`
- Modify: `tasks/lessons.md`

**Step 1: Run cleanup searches**

Run:

```bash
rg -n "agent_relationship_context|relationshipTendencies|defaultRelationshipStance|persona_memories|\\[agent_memory\\]" docs plans src/lib/ai src/components
```

Expected:

- no active production prompt/runtime code depends on relationship-context blocks, relationship tendency fields, generated persona memories, or active memory prompt blocks
- historical plan/example docs may still mention retired names if clearly labeled historical
- durable memory-module table access may still mention `persona_memories`
- tests may assert that retired prompt blocks/fields are absent
- this integration plan may mention the legacy strings as cleanup/search targets

**Step 2: Write the minimal implementation**

- Keep active docs aligned with the integrated target state.
- Mark outdated examples as historical instead of leaving them ambiguous.
- Remove any active wording that suggests:
  - relationship prompt/runtime inputs still exist
  - `persona_memories` remains in the active generate-persona contract
  - prompt families still emit `agent_memory`

**Step 3: Re-run cleanup searches**

Run the same `rg` command and classify the remaining hits using the expected categories above. Any uncategorized active production prompt/runtime hit must be removed.

**Step 4: Commit**

```bash
git add docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md docs/ai-agent/llm-flows/prompt-block-examples.md docs/ai-agent/llm-flows/flow-audit-repair-examples.md docs/ai-agent/llm-flows/archive/persona-generation-prompt-examples.md tasks/todo.md tasks/lessons.md
git commit -m "docs: align active llm flow contracts"
```

## Task 6: Final Integrated Verification ✅ DONE

**Files:**

- Verify only; no new files.

**Step 1: Run targeted tests**

```bash
npm run test:llm-flows
```

Expected: PASS.

**Step 2: Run targeted lint**

```bash
npx eslint src/lib/ai/prompt-runtime src/lib/ai/agent/execution src/lib/ai/admin src/lib/ai/core src/components/admin/control-plane/PersonaStructuredPreview.tsx
```

Expected: PASS.

**Step 3: Run project typecheck**

```bash
npm run typecheck
```

Expected: PASS.

**Step 4: Run final legacy-contract search**

```bash
rg -n "agent_relationship_context|relationshipTendencies|defaultRelationshipStance|persona_memories|\\[agent_memory\\]" docs plans src/lib/ai src/components
```

Expected: only categorized hits remain: historical docs, this plan's own search strings, durable memory-module table access, or tests asserting absence. No active production prompt/runtime dependency may remain.

**Step 5: Review against end-state checklist**

Confirm all of the following are true:

- no app-owned parallel text-generation path exists outside the registry
- `post` is staged and uses deterministic hard gating
- `comment` and `reply` are first-class separate flows
- notification generation routes into `reply`
- audit packets are compact and repair packets are fuller across flows
- persona-fit judging uses shared compact persona evidence
- writer-family main generation internally self-checks:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- active prompt families do not emit relationship or memory blocks
- generate-persona uses only `seed -> persona_core`
- generate-persona omits `persona_memories`

## Completion Rule

This program is not complete until:

- all six tasks land
- targeted tests/lint/typecheck/searches pass
- active docs describe only the latest contract
- no caller bypasses the shared registry for app-owned text generation
