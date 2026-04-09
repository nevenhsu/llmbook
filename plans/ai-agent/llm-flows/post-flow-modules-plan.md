# Post Flow Modules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current one-shot post generation path with a staged `post_plan -> post_body` flow, then make that flow the only app-owned post generation path behind shared text flow modules.

**Architecture:** Introduce one shared text flow module boundary for `post`, `comment`, and `reply`, and route generator, preview, runtime, and jobs through that boundary instead of calling ad hoc post/comment logic directly. Implement `post` first as a staged module with app-owned hard gating, locked selected title, and one merged body audit; keep `comment` and `reply` on the same module interface even if their internal behavior stays single-stage until their dedicated design passes land.

**Tech Stack:** TypeScript, Vitest, existing `prompt-runtime` contracts, `AiAgentPersonaTaskGenerator`, `AiAgentPersonaTaskExecutor`, `AiAgentPersonaInteractionService`, Supabase persistence.

---

## Guardrails

- `post_plan` owns title selection, novelty, and `title_persona_fit`.
- `post_body` must not output `title`.
- `post_body` uses one merged audit for content quality + persona fit.
- App code computes hard-gate ranking deterministically; the model does not own final candidate selection.
- No app surface may keep a second hidden `post`, `comment`, or `reply` generation path outside the shared flow-module registry.
- `comment` and `reply` design details are not finalized here, but the module boundary must be introduced now so future work lands inside the same abstraction.

## Target Shape

```text
persona task / preview request
  -> resolve flow module
  -> flow module runs staged prompt/audit pipeline
  -> canonical parsed result
  -> persistence/render layer
```

For `post`, the staged pipeline becomes:

```text
post_plan.main
-> schema_validate
-> schema_repair?
-> deterministic_checks
-> planning_audit
-> planning_repair?
-> recheck
-> app hard gate + deterministic ranking
-> post_body.main
-> schema_validate
-> schema_repair?
-> deterministic_checks
-> post_body_audit
-> body_repair?
-> recheck
-> deterministic render
-> persistence
```

## Task 1: Introduce The Shared Text Flow Module Boundary

**Files:**

- Create: `src/lib/ai/agent/execution/flows/types.ts`
- Create: `src/lib/ai/agent/execution/flows/registry.ts`
- Create: `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- Create: `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-context-builder.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/index.ts`
- Test: `src/lib/ai/agent/execution/persona-task-context-builder.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`

**Step 1: Write the failing tests**

- Add a context-builder test that requires a resolved `flowKind` instead of relying on `taskType` alone.
- Add a generator test that proves `post`, `comment`, and `reply` all route through the flow-module registry and that generator code no longer parses raw post/comment output itself.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts
```

Expected: failures showing missing `flowKind` / missing registry-based generation path.

**Step 3: Write the minimal architecture**

- Add a shared module interface with:
  - `flowKind`
  - `runPreview()`
  - `runRuntime()`
  - shared parsed-result shape
- Extend prompt-context building to resolve `flowKind`:
  - `post`
  - `comment`
  - `reply`
- Make `AiAgentPersonaTaskGenerator` resolve a module from the registry and call the module instead of calling `runPersonaInteraction()` plus `parsePostActionOutput()` / `parseMarkdownActionOutput()` inline.
- Create temporary `comment` / `reply` adapter modules that preserve current behavior until their dedicated redesign is approved.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/flows src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/index.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts
git commit -m "refactor: route text generation through shared flow modules"
```

## Task 2: Add The Post Planning Contract And Hard-Gate Utilities

**Files:**

- Create: `src/lib/ai/prompt-runtime/post-plan-contract.ts`
- Create: `src/lib/ai/prompt-runtime/post-plan-contract.test.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `plans/ai-agent/operator-console/prompt-block-examples.md`

**Step 1: Write the failing tests**

- Add parser/validator tests for canonical `post_plan` JSON.
- Lock deterministic checks for:
  - exactly 3 candidates
  - unique titles
  - integer scores `0-100`
  - required `title_persona_fit_score`
  - no model-owned `overall_score`
- Add prompt-builder coverage for the new `selected_post_plan` block and split output constraints between planning-stage and body-stage prompts.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts
```

Expected: failures showing missing planning contract support and prompt constraints.

**Step 3: Write the minimal implementation**

- Define canonical planning JSON:
  - `candidates[]`
  - `title`
  - `angle_summary`
  - `thesis`
  - `body_outline`
  - `difference_from_recent`
  - `board_fit_score`
  - `title_persona_fit_score`
  - `title_novelty_score`
  - `angle_novelty_score`
  - `body_usefulness_score`
- Add deterministic app-owned helpers for:
  - plan validation
  - hard-gate thresholds
  - deterministic weighted ranking
- Document in prompt examples that `recent_board_posts` remains the source block, but novelty evaluation now happens in the planning stage instead of the final post body prompt.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/post-plan-contract.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts plans/ai-agent/operator-console/prompt-block-examples.md
git commit -m "feat: add staged post planning contract"
```

## Task 3: Implement The `post_plan` Module Stage

**Files:**

- Create: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`

**Step 1: Write the failing tests**

- Add coverage that `post` no longer performs one-shot `title/body/tags` generation.
- Add coverage that `post_plan` retries schema repair and planning repair once, then either:
  - selects the highest-ranked passing candidate
  - or fails terminally when no candidate passes
- Add preview coverage that planning diagnostics surface the selected candidate and gate status.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: failures because the staged planning pipeline does not exist yet.

**Step 3: Write the minimal implementation**

- Add `post` flow-module orchestration for:
  - planning prompt
  - schema repair
  - deterministic checks
  - planning audit
  - planning repair
  - deterministic ranking
- Keep `title` locked once a candidate is selected.
- Preserve stage-local diagnostics so preview/runtime can tell whether failure came from schema validation, planning audit, or hard-gate rejection.
- Do not yet change comment/reply semantics; they stay behind their module adapters.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/flows/post-flow-module.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/admin/control-plane-store.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
git commit -m "feat: add staged post planning flow"
```

## Task 4: Implement The `post_body` Contract, Audit, And Repair Loop

**Files:**

- Create: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Create: `src/lib/ai/prompt-runtime/post-body-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`
- Test: `src/lib/ai/agent/execution/execution-preview.test.ts`

**Step 1: Write the failing tests**

- Add a post-body parser test that rejects `title` in body-stage JSON and accepts only:
  - `body`
  - `tags`
  - `need_image`
  - `image_prompt`
  - `image_alt`
- Add audit tests that merge content quality and persona checks into one body-stage audit contract.
- Add preview tests that render a final post from locked `title + tags + body` and expose body-stage audit diagnostics.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/agent/execution/execution-preview.test.ts
```

Expected: failures because post parsing still expects one-shot `title/body/tags` output and no merged body audit exists.

**Step 3: Write the minimal implementation**

- Split post parsing into:
  - planning result parsing
  - body-stage result parsing
  - deterministic final render
- Add merged `post_body_audit` JSON with:
  - `passes`
  - `issues`
  - `repairGuidance`
  - `contentChecks`
  - `personaChecks`
- Always allow one body repair attempt on audit failure.
- Keep title immutable during body repair.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/post-body-audit.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/action-output.ts src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/agent/execution/flows/post-flow-module.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/agent/execution/execution-preview.test.ts
git commit -m "feat: add staged post body audit and repair"
```

## Task 5: Route All App-Owned Post Generation Through The Flow Registry

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-task-executor.ts`
- Modify: `src/lib/ai/agent/execution/text-runtime-service.ts`
- Modify: `src/lib/ai/agent/jobs/jobs-runtime-service.ts`
- Modify: `src/lib/ai/README.md`
- Modify: `tasks/todo.md`
- Test: `src/lib/ai/agent/execution/persona-task-executor.test.ts`
- Test: `src/lib/ai/agent/execution/text-runtime-service.test.ts`
- Test: `src/lib/ai/agent/jobs/jobs-runtime-service.test.ts`

**Step 1: Write the failing tests**

- Lock `text-runtime` and `jobs-runtime` onto the flow-module registry for post generation.
- Add regression coverage that no caller reaches old one-shot post parsing directly.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-executor.test.ts src/lib/ai/agent/execution/text-runtime-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts
```

Expected: failures because the execution stack still assumes one-shot post output or bypasses the registry.

**Step 3: Write the minimal implementation**

- Ensure runtime execution depends on the shared flow registry and canonical parsed result shapes.
- Update repo docs so the shared flow-module boundary is the only described app-owned path for `post`, `comment`, and `reply`.
- Explicitly note in docs/task tracking that `comment` and `reply` still need dedicated design passes, but no new parallel generation paths may be added outside the registry.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/persona-task-executor.ts src/lib/ai/agent/execution/text-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/README.md tasks/todo.md src/lib/ai/agent/execution/persona-task-executor.test.ts src/lib/ai/agent/execution/text-runtime-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts
git commit -m "refactor: make flow modules the only app-owned text path"
```

## Task 6: Final Verification

**Files:**

- Verify only; no new files.

**Step 1: Run targeted tests**

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/execution-preview.test.ts src/lib/ai/agent/execution/persona-task-executor.test.ts src/lib/ai/agent/execution/text-runtime-service.test.ts src/lib/ai/agent/jobs/jobs-runtime-service.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS.

**Step 2: Run targeted lint**

```bash
npx eslint src/lib/ai/agent/execution/flows src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/agent/execution/execution-preview.ts src/lib/ai/agent/execution/persona-task-executor.ts src/lib/ai/agent/execution/text-runtime-service.ts src/lib/ai/agent/jobs/jobs-runtime-service.ts src/lib/ai/prompt-runtime/post-plan-contract.ts src/lib/ai/prompt-runtime/post-body-audit.ts src/lib/ai/prompt-runtime/action-output.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts src/lib/ai/admin/control-plane-store.ts
```

Expected: PASS.

**Step 3: Run filtered TypeScript**

```bash
npx tsc --noEmit 2>&1 | rg "src/lib/ai/agent/execution/flows|src/lib/ai/agent/execution/persona-task-context-builder|src/lib/ai/agent/execution/persona-task-generator|src/lib/ai/agent/execution/persona-interaction-service|src/lib/ai/agent/execution/execution-preview|src/lib/ai/agent/execution/persona-task-executor|src/lib/ai/agent/execution/text-runtime-service|src/lib/ai/agent/jobs/jobs-runtime-service|src/lib/ai/prompt-runtime/post-plan-contract|src/lib/ai/prompt-runtime/post-body-audit|src/lib/ai/prompt-runtime/action-output|src/lib/ai/prompt-runtime/prompt-builder|src/lib/ai/prompt-runtime/runtime-budgets|src/lib/ai/admin/control-plane-store"
```

Expected: no matches for the touched files.

## Follow-Up Plans

- Write a dedicated design + implementation plan for `comment` flow on top-level post replies.
- Write a dedicated design + implementation plan for thread `reply` flow.
- Once both land, tighten the registry so unresolved flow kinds cannot fall back to a generic comment path.
