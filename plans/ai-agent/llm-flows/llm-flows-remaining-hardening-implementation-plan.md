# LLM Flows Remaining Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining hardening work from `plans/ai-agent/llm-flows/llm-flows-improvements-optimization-plan.md` so staged LLM flows fail closed, surface useful diagnostics, and keep active contracts free of retired compatibility paths.

**Architecture:** Keep text-flow orchestration inside flow modules and keep persona generation as a strict two-stage `seed -> persona_core` pipeline. Use TDD for each behavior change: first add a focused failing contract/flow test, then implement the smallest contract change, then run the targeted test before moving to the next task. Do not add compatibility branches for retired contracts.

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, AI prompt-runtime contracts, LLM flow modules, admin control-plane store, Supabase-backed persistence.

---

## Guardrails

- Active plans live under `/plans`; do not create active plan docs under `docs/plans`.
- Do not reintroduce dual-read or dual-write compatibility for retired persona-generation fields.
- Do not change dedicated memory-module APIs unless the test explicitly targets generate-persona save/update payloads.
- Keep model-owned JSON semantic only; app-owned ids, routing keys, final ranking, and persistence metadata stay outside model output.
- Keep flow modules as parser/audit/repair owners. The raw stage service invokes the model and returns raw text only.
- Follow the repo rule that the user handles git independently; this plan contains no git operation steps.

## Task 1: Harden Persona-Generation Stage Parsers

**Why:** `seed` and `persona_core` still accept wrapper roots, fenced JSON, aliases, status coercion, and extra nested keys. Current active development has no compatibility requirement for those retired shapes.

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Test: `src/lib/ai/admin/persona-generation-contract.test.ts`

**Step 1: Add failing parser tests**

Add tests proving:

- `parsePersonaSeedOutput()` rejects wrapper objects such as `{ "seed": { ...canonicalSeed } }`.
- `parsePersonaSeedOutput()` and `parsePersonaCoreStageOutput()` reject fenced JSON.
- `parsePersonaSeedOutput()` rejects `persona.status` values other than `"active"` or `"inactive"`.
- `parsePersonaCoreStageOutput()` rejects top-level fit keys: `value_fit`, `reasoning_fit`, `discourse_fit`, `expression_fit`.
- `parsePersonaCoreStageOutput()` rejects `creator_admiration`; only `creator_affinity` is allowed.
- `parsePersonaCoreStageOutput()` rejects `task_style_matrix.comment.body_shape`; only `feedback_shape` is allowed.
- `parsePersonaCoreStageOutput()` rejects forbidden extra keys in each nested persona-core section.
- `parsePersonaGenerationSemanticAuditResult()` rejects extra top-level keys.

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-contract.test.ts
```

Expected: FAIL for the new strictness tests before implementation.

**Step 2: Add exact-key helpers**

In `persona-generation-contract.ts`, add:

```ts
function assertExactKeys(
  record: Record<string, unknown>,
  fieldPath: string,
  allowed: string[],
): void {
  const allowedSet = new Set(allowed);
  const extra = Object.keys(record).filter((key) => !allowedSet.has(key));
  if (extra.length > 0) {
    throw new Error(
      `${fieldPath} contains forbidden key${extra.length === 1 ? "" : "s"} ${extra.join(", ")}`,
    );
  }
}
```

Use it for:

- `seed` root
- `seed.persona`
- semantic audit JSON
- `persona_core` root
- `identity_summary`
- `values`
- `aesthetic_profile`
- `lived_context`
- `creator_affinity`
- `interaction_defaults`
- `guardrails`
- `voice_fingerprint`
- `task_style_matrix`
- `task_style_matrix.post`
- `task_style_matrix.comment`

**Step 3: Remove parser compatibility paths**

- Delete `unwrapPersonaStageRoot()` usage from active canonical stage parsers.
- Replace `extractJsonFromText()` use in canonical stage parsing with strict JSON-object parsing that accepts only raw JSON object text.
- Remove `creator_admiration` fallback.
- Remove `comment.body_shape` fallback.
- Replace persona status coercion with explicit validation for `"active"` and `"inactive"`.
- Remove object spreads that preserve unknown keys in normalized output.

**Step 4: Verify Task 1**

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-contract.test.ts
```

Expected: PASS.

## Task 2: Fail Persona Semantic Audits Closed And Remove Generate-Persona Memory Payloads

**Why:** Empty/invalid semantic audit JSON still passes open for seed originalization and persona-core quality. Generate-persona save/update routes still expose `personaMemories`, even though generated memories were retired from the active pipeline.

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/app/api/admin/ai/personas/route.ts`
- Modify: `src/app/api/admin/ai/personas/[id]/route.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts`
- Test: `src/app/api/admin/ai/personas/route.test.ts`
- Test: `src/app/api/admin/ai/personas/[id]/route.test.ts`

**Step 1: Add failing audit tests**

Add tests proving:

- Empty `seed_originalization_audit` output returns semantic issues and triggers repair instead of passing.
- Invalid `seed_originalization_audit` JSON returns semantic issues and triggers repair instead of passing.
- Empty `persona_core_quality_audit` output returns semantic issues and triggers repair instead of passing.
- Invalid `persona_core_quality_audit` JSON returns semantic issues and triggers repair instead of passing.

Run:

```bash
npm test -- src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts
```

Expected: FAIL before fail-closed wiring.

**Step 2: Add failing memory-surface tests**

Add tests proving:

- `AdminAiControlPlaneStore.createPersona()` rejects `personaMemories` in generate-persona create payloads.
- `AdminAiControlPlaneStore.patchPersonaProfile()` rejects `personaMemories` in generate-persona update payloads.
- `POST /api/admin/ai/personas` does not forward `personaMemories` from request JSON to the store.
- `PATCH /api/admin/ai/personas/[id]` does not forward `personaMemories` from request JSON to the store.

Run:

```bash
npm test -- src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts src/app/api/admin/ai/personas/route.test.ts src/app/api/admin/ai/personas/[id]/route.test.ts
```

Expected: FAIL before removing the surface.

**Step 3: Implement fail-closed audits**

Set `failClosedOnTransport: true` and useful `fallbackRepairGuidance` for:

- `seed_originalization_audit`
- `persona_core_quality_audit`

Keep `seed_reference_source_audit` fail-closed behavior unchanged.

**Step 4: Remove generate-persona memory payload acceptance**

- Remove `personaMemories` from route body forwarding in both persona create/update routes.
- Remove `personaMemories` from `createPersona()` and `patchPersonaProfile()` input contracts used by generate-persona save/update.
- Delete memory insert/delete branches from those generate-persona methods.
- Keep `getPersonaProfile()` memory reads and dedicated memory-module APIs untouched.

**Step 5: Verify Task 2**

Run:

```bash
npm test -- src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts src/app/api/admin/ai/personas/route.test.ts src/app/api/admin/ai/personas/[id]/route.test.ts
```

Expected: PASS.

## Task 3: Replace Deterministic-Only `post_plan` Audit With Semantic Audit Stage

**Why:** The current `postPlanAudit()` is deterministic score checking. The active plan calls for a compact semantic LLM audit/parser before hard-gate selection so novelty reasoning, persona-native angle fit, and outline usefulness are judged semantically.

**Files:**

- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- Test: `src/lib/ai/prompt-runtime/post-plan-audit.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Modify: `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`

**Step 1: Add failing prompt/parser tests**

Add tests proving:

- `buildPostPlanAuditPrompt()` states the packet is intentionally compact.
- `buildPostPlanAuditPrompt()` includes candidates, board context, target context, and persona evidence.
- `parsePostPlanAuditResult()` rejects empty output.
- `parsePostPlanAuditResult()` rejects invalid JSON.
- `parsePostPlanAuditResult()` rejects missing checks.
- `parsePostPlanAuditResult()` rejects extra top-level keys.
- `parsePostPlanAuditResult()` normalizes valid audit JSON.

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-audit.test.ts
```

Expected: FAIL before prompt/parser implementation.

**Step 2: Add failing flow tests**

Add tests proving:

- `post_plan` calls `runPersonaInteractionStage()` with `stagePurpose: "audit"` after schema validation and deterministic checks.
- Failed semantic planning audit calls one `stagePurpose: "quality_repair"` planning repair before hard-gate ranking.
- Repaired planning output is revalidated and reaudited.
- Fresh planning regeneration after hard-gate failure also runs semantic planning audit before selection.
- Terminal planning audit failure throws `TextFlowExecutionError` with `causeCategory: "semantic_audit"` and `diagnostics.planningAudit.status: "failed"`.

Run:

```bash
npm test -- src/lib/ai/agent/execution/flows/post-flow-module.test.ts
```

Expected: FAIL before flow wiring.

**Step 3: Implement post-plan semantic audit contract**

In `post-plan-audit.ts`:

- Keep deterministic helper behavior if useful, but rename it to avoid conflating it with the semantic audit.
- Add `buildPostPlanAuditPrompt()`.
- Add `buildPostPlanRepairPrompt()` if the flow needs a centralized repair prompt.
- Add `parsePostPlanAuditResult()`.
- Enforce exact top-level keys: `passes`, `issues`, `repairGuidance`, `checks`.
- Enforce exact checks:
  - `candidate_count`
  - `board_fit`
  - `novelty_evidence`
  - `persona_posting_lens_fit`
  - `body_outline_usefulness`
  - `no_model_owned_final_selection`

**Step 4: Wire semantic audit into post flow**

Order inside `post-flow-module.ts`:

```text
post_plan.main
-> schema_validate
-> schema_repair?
-> deterministic_checks
-> semantic planning audit
-> planning repair?
-> schema_validate
-> deterministic_checks
-> semantic planning audit
-> hard gate + deterministic ranking
-> fresh regenerate once if no candidate passes
```

Update `FlowDiagnostics["planningAudit"]` to allow `status: "failed"` and include failed audit details on terminal errors.

**Step 5: Update examples**

Refresh `flow-audit-repair-examples.md` with the new `post_plan_audit` JSON shape.

**Step 6: Verify Task 3**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-audit.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts
```

Expected: PASS.

## Task 4: Surface Flow Failure Diagnostics To Runtime Consumers

**Why:** `TextFlowExecutionError` exists, but queue/operator surfaces still largely collapse failures to plain strings and some invalid audit JSON is misclassified.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/text-lane-service.ts`
- Modify: `src/lib/ai/agent/operator-console/task-table-read-model.ts`
- Test: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/agent/execution/text-lane-service.test.ts`
- Test: `src/lib/ai/agent/operator-console/task-table-read-model.test.ts`

**Step 1: Add failing classification tests**

Add tests proving:

- Invalid comment audit JSON classifies as `semantic_audit`, not `transport`.
- Invalid reply audit JSON classifies as `semantic_audit`, not `transport`.
- Invalid post-body audit JSON classifies as `semantic_audit`, not `schema_validation`.
- Quality repair output that cannot parse classifies as `quality_repair`.

Run:

```bash
npm test -- src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts
```

Expected: FAIL before classification changes.

**Step 2: Add failing runtime-surface tests**

Add tests proving:

- `AiAgentPersonaTaskGenerator.generateFromTask()` preserves `TextFlowExecutionError` diagnostics in a typed failure payload or rethrows the typed error unchanged.
- `text-lane-service` stores/records the flow failure category and compact diagnostics in task error metadata if the persistence layer supports metadata; if not, it serializes a compact suffix into `errorMessage` without losing the category.
- `task-table-read-model` exposes the category/diagnostic metadata for operator inspection when available.

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/text-lane-service.test.ts src/lib/ai/agent/operator-console/task-table-read-model.test.ts
```

Expected: FAIL before runtime-surface changes.

**Step 3: Implement classification fixes**

- Make audit parse failures and terminal audit failures map to `semantic_audit`.
- Make repair-output parse failures from quality repair map to `quality_repair`.
- Preserve existing transport classification for provider/stage invocation failures.

**Step 4: Preserve diagnostics through runtime**

Implement the smallest compatible runtime surface:

- If task failure storage accepts metadata, store `{ flowKind, causeCategory, diagnostics }`.
- If task failure storage does not accept metadata, include a compact structured suffix such as `flow_failure={"flowKind":"comment","causeCategory":"semantic_audit","terminalStage":"comment.main"}` in `errorMessage`.
- Ensure operator read models can expose the compact category without needing to parse full diagnostics if schema support is not present.

**Step 5: Verify Task 4**

Run:

```bash
npm test -- src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/text-lane-service.test.ts src/lib/ai/agent/operator-console/task-table-read-model.test.ts
```

Expected: PASS.

## Task 5: Final Docs And Verification

**Files:**

- Modify: `plans/ai-agent/llm-flows/llm-flows-improvements-optimization-plan.md`
- Modify: `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`
- Modify: `tasks/todo.md`

**Step 1: Update status markers**

- Mark completed remaining-hardening tasks in `llm-flows-improvements-optimization-plan.md`.
- Ensure no active examples teach old persona-generation aliases, old `persona_fit` audit shape, or deterministic-only `post_plan` audit as the final contract.

**Step 2: Run docs searches**

Run:

```bash
rg -n 'creator_admiration|body_shape|persona_fit|fenced JSON|wrapper' plans/ai-agent/llm-flows docs/dev-guidelines/08-llm-json-stage-contract.md
```

Expected: only intentional historical references or explicit rejection examples remain.

**Step 3: Run final verification**

Run:

```bash
npm run test:llm-flows
npm run typecheck
npm run lint
npm run verify
```

Expected:

- LLM-flow tests pass.
- TypeScript passes.
- Lint has no new warnings from touched files.
- `verify` exits 0.

## Completion Criteria

- Canonical persona-generation stage parsers reject wrappers, fenced JSON, aliases, extra keys, direct fit keys, and unknown persona statuses.
- Persona-generation semantic audits fail closed for seed originalization, seed reference classification, and persona-core quality.
- Generate-persona create/update flows do not accept generated memory payloads.
- `post_plan` has an LLM semantic audit/repair stage before hard-gate selection.
- Flow terminal errors are classified accurately and surfaced to runtime/operator consumers.
- Active docs and examples match the implemented contracts.
- `npm run verify` exits 0.
