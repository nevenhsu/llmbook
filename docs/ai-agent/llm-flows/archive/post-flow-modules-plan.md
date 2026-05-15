# Post Flow Modules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current one-shot post generation path with a staged `post_plan -> post_body` flow, then make that flow the only app-owned post generation path behind shared text flow modules.

**Architecture:** Introduce one shared text flow module boundary for `post`, `comment`, and `reply`, and route generator, preview, runtime, and jobs through that boundary instead of calling ad hoc post/comment logic directly. Implement `post` first as a staged module with app-owned hard gating, locked selected title, and one merged body audit; keep `comment` and `reply` on the same module interface even if their internal behavior stays single-stage until their dedicated design passes land.

**Tech Stack:** TypeScript, Vitest, existing `prompt-runtime` contracts, `AiAgentPersonaTaskGenerator`, `AiAgentPersonaTaskExecutor`, `AiAgentPersonaInteractionService`, Supabase persistence.

---

## Guardrails

- `post_plan` owns title selection, novelty, and `title_persona_fit`.
- `post_plan` must always return exactly 3 candidates, and the app hard gate must select the highest-ranked passing candidate.
- `post_body` must not output `title`.
- `post_body` uses one merged audit for content quality + persona fit.
- `post_body.main` must internally self-check draft fidelity before emitting final JSON.
- That internal self-check must cover:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- App code computes hard-gate ranking deterministically; the model does not own final candidate selection.
- Any `post_plan` or `post_body` audit/repair step that judges persona fit must receive compact persona evidence from canonical persona fields. At minimum this includes `reference_sources` names plus a derived post-oriented persona lens.
- `post_plan` and `post_body` audits consume compact review packets; repairs consume fuller rewrite packets.
- Audit prompts must know the packet is intentionally compact and must not fail just because omitted generation context is absent.
- If no candidate passes the hard gate after repair/recheck, rerun `post_plan.main` once as a fresh candidate generation before terminal failure.
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

## Why A Shared Flow-Module Registry Exists

The registry is not here to make `post`, `comment`, and `reply` artificially identical.

It exists to unify the execution boundary:

- preview, runtime, generator, and jobs all need one place to resolve flow kind
- flow-specific orchestration should stay inside the flow module, not leak back into callers
- the app must not keep parallel text-generation paths that drift over time
- adding a new flow should mean registering one new module, not editing every caller branch

The registry therefore standardizes:

- flow resolution
- module entrypoints
- typed result envelope
- high-level diagnostics ownership

It does **not** require all flows to share the same internal pipeline or parsed payload fields.

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
-> fresh post_plan regenerate once if all candidates still fail
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

## Shared Result Envelope

The registry should not return an untyped loose object.

It should return one discriminated result envelope keyed by `flowKind`, so callers branch on the declared flow kind instead of guessing from optional fields.

Recommended shape:

```ts
type FlowRunResult =
  | {
      flowKind: "post";
      parsed: {
        selectedPostPlan: SelectedPostPlan;
        postBody: PostBodyOutput;
        renderedPost: RenderedPost;
      };
      diagnostics: FlowDiagnostics;
    }
  | {
      flowKind: "comment";
      parsed: {
        comment: CommentOutput;
      };
      diagnostics: FlowDiagnostics;
    }
  | {
      flowKind: "reply";
      parsed: {
        reply: ReplyOutput;
      };
      diagnostics: FlowDiagnostics;
    };
```

Rules:

- callers branch on `flowKind`, not on ad hoc field presence
- `post` may carry richer staged diagnostics than `comment`/`reply`
- `comment` and `reply` may stay simpler, but they still use the same outer envelope
- registry consumers should not need to re-infer whether a result came from a staged or single-stage flow

## Minimal `FlowDiagnostics` Contract

The shared result envelope also needs one minimum diagnostics contract so preview, runtime, generator, and jobs do not invent different ad hoc status payloads.

Recommended minimum shape:

```ts
type FlowDiagnostics = {
  finalStatus: "passed" | "failed";
  terminalStage: string | null;
  attempts: Array<{
    stage: string;
    main: number;
    schemaRepair: number;
    repair: number;
    regenerate: number;
  }>;
  stageResults: Array<{
    stage: string;
    status: "passed" | "failed" | "skipped";
  }>;
  gate?: {
    attempted: boolean;
    passedCandidateIndexes: number[];
    selectedCandidateIndex: number | null;
  };
};
```

Rules:

- this is the stable minimum shared across preview and runtime
- attempt counts must stay per-stage; do not merge `post_plan` and `post_body` into one aggregate counter
- richer debug artifacts may live elsewhere, but they must not replace this minimum contract
- `gate` is populated for `post` and omitted for `comment` / `reply`

## Audit / Repair Packet Shape

For `post`:

- `planning_audit`
  - receives a compact review packet
  - keeps full candidate entries
  - keeps compact board/recent-post/persona evidence
- `planning_repair`
  - receives a fuller rewrite packet
  - includes previous output, audit issues, repair guidance, and enough planning context to regenerate safely
- `post_body_audit`
  - receives a compact review packet
  - keeps the full rendered final post
  - keeps compact selected-plan/persona/board evidence
- `body_repair`
  - receives a fuller rewrite packet
  - includes previous output, audit issues, repair guidance, locked selected plan, and enough context to rewrite body-stage JSON safely

Audit prompts must be instructed not to complain that the packet is incomplete when the app has intentionally compacted surrounding context.

For persona fidelity, `post_body_audit` should explicitly judge:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

The merged body/persona audit may still expose higher-level `personaChecks`, but these four dimensions should be the specific doctrine checks underneath.

## `selected_post_plan` Contract

`selected_post_plan` is an app-owned deterministic block passed from planning into `post_body`.

Required fields:

- locked title
- angle summary
- idea
- outline
- difference from recent

Excluded fields:

- candidate scores
- hard-gate decisions
- recent-board evidence already consumed in planning

Rule:

- `post_body`, `post_body_audit`, and `body_repair` may expand or judge this block, but they must not reopen planning or mutate the title/topic.

## Writer Doctrine Rule

`post_body` should not treat persona fidelity as a purely external audit concern.

Its main generation prompt should tell the model to internally test the draft against the selected plan and the persona doctrine before output:

- does the draft protect and attack the right things
- does it reason the way this persona should
- does the discourse shape feel like this persona's post structure
- does the expression pressure feel native to the persona rather than generic assistant prose

This internal self-check must stay silent in output and should only affect revision before the final JSON object is emitted.

## Attempt Budget

`post` uses the most complex flow, so its attempt budget becomes the reference policy for simpler text flows.

- initial `post_plan.main`: 1
- `schema_repair`: at most 1 per planning or body generation attempt
- `planning_repair`: at most 1 per planning generation attempt
- `body_repair`: at most 1 per body generation attempt
- fresh `post_plan.main` regenerate: at most 1 after the initial planning path still fails the hard gate or ends terminally
- after the regenerate path exhausts its repair budget, the flow terminal-fails

This keeps retry behavior explicit and prevents hidden infinite loops in preview or runtime orchestration.

## Final Output Alignment

`post_body` should align with `comment` and `reply` on one shared writer-output pattern:

- exactly one JSON object
- shared media tail:
  - `need_image`
  - `image_prompt`
  - `image_alt`

`post_body` keeps post-specific fields:

- `body`
- `tags`

This keeps writer-flow output constraints aligned without forcing `comment`/`reply` to adopt post tags.

## Task 1: Introduce The Shared Text Flow Module Boundary ✅ DONE

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
  - shared typed result envelope
- Extend prompt-context building to resolve `flowKind`:
  - `post`
  - `comment`
  - `reply`
- Make `AiAgentPersonaTaskGenerator` resolve a module from the registry and call the module instead of calling `runPersonaInteraction()` plus `parsePostActionOutput()` / `parseMarkdownActionOutput()` inline.
- Make the registry return a discriminated result envelope so callers branch on `flowKind` instead of checking for random optional fields.
- Create temporary `comment` / `reply` adapter modules that preserve current behavior until their dedicated redesign is approved.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/flows src/lib/ai/agent/execution/persona-task-context-builder.ts src/lib/ai/agent/execution/persona-task-generator.ts src/lib/ai/agent/execution/index.ts src/lib/ai/agent/execution/persona-task-context-builder.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts
git commit -m "refactor: route text generation through shared flow modules"
```

## Task 2: Add The Post Planning Contract And Hard-Gate Utilities ✅ DONE

**Files:**

- Create: `src/lib/ai/prompt-runtime/post-plan-contract.ts`
- Create: `src/lib/ai/prompt-runtime/post-plan-contract.test.ts`
- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `docs/ai-agent/llm-flows/prompt-block-examples.md`

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
  - `idea`
  - `outline`
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
git add src/lib/ai/prompt-runtime/post-plan-contract.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/prompt-runtime/runtime-budgets.ts docs/ai-agent/llm-flows/prompt-block-examples.md
git commit -m "feat: add staged post planning contract"
```

## Task 3: Implement The `post_plan` Module Stage ✅ DONE

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
- If no candidate passes after the normal repair/recheck path, run one fresh `post_plan.main` regeneration before terminal fail.
- Feed `planning_audit` and `planning_repair` a compact persona-evidence block so `title_persona_fit` is judged against canonical persona data instead of board context alone.
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

## Task 4: Implement The `post_body` Contract, Audit, And Repair Loop ✅ DONE

> **Status:** Completed, including merged body audit/repair loop wiring and regenerate schema-repair reset.

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
- Keep `post_body` output constraints aligned with the shared writer media tail:
  - `need_image`
  - `image_prompt`
  - `image_alt`
- Feed `post_body_audit` and `body_repair` a compact persona-evidence block derived from canonical persona fields so body/persona checks stay grounded in the actual persona contract.
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

## Task 5: Route All App-Owned Post Generation Through The Flow Registry ✅ DONE

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

## Task 6: Final Verification ✅ DONE

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

**Step 3: Run project typecheck**

```bash
npm run typecheck
```

Expected: PASS.

## Follow-Up Plans

- Write a dedicated design + implementation plan for `comment` flow on top-level post replies.
- Write a dedicated design + implementation plan for thread `reply` flow.
- Once both land, tighten the registry so unresolved flow kinds cannot fall back to a generic comment path.
