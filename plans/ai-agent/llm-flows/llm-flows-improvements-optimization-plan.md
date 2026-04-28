# LLM Flows Improvements And Optimizations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the current LLM-flow implementation after the initial integration pass, so runtime execution has one orchestration owner, strict JSON contracts, canonical persona evidence in audits, accurate diagnostics, and a consolidated verification path.

**Architecture:** Keep the shared text flow registry as the public boundary for `post`, `comment`, and `reply`, but split raw LLM stage invocation away from parsed/audited preview rendering. Flow modules should own schema validation, repair, audit, quality repair, deterministic gates, and diagnostics. Admin preview services should call into the same stage boundary instead of duplicating text-flow orchestration. Persona generation remains its own two-stage `seed -> persona_core` pipeline, but its parsers and semantic audits must become strict fail-closed contracts.

**Tech Stack:** TypeScript, Vitest, prompt-runtime contracts, AI agent flow modules, admin control-plane store, persona-generation staged JSON, Supabase persistence, npm verification scripts.

---

## Review Summary

The integrated flow architecture is substantially landed:

- `post`, `comment`, and `reply` resolve through a shared flow registry.
- `post` uses `post_plan -> post_body`, deterministic hard-gate ranking, locked titles, and body audit diagnostics.
- `comment` and `reply` have first-class audit contracts with four persona doctrine checks.
- `generate persona` is now a two-stage `seed -> persona_core` flow with generated memories omitted from preview/save helpers.
- Historical persona-generation docs are clearly labeled.

The next pass should focus on correctness and simplification rather than adding new behavior. The highest-risk finding is that flow modules call the high-level `runPersonaInteraction` callback for audit/repair stages. That service also parses and audits by `taskType`, so an audit JSON response can be treated as invalid generated content before the flow module ever sees it. Tests currently mock this callback at too high a level, so they do not cover the default store-backed path.

## Guardrails

- Do not add compatibility branches for retired contracts.
- Flow modules are the single owner of text-flow orchestration.
- LLM JSON parsers reject forbidden extra keys unless a contract explicitly allows them.
- Audit stages fail closed when audit JSON is empty, invalid, or missing required checks.
- Persona-fit audits must receive canonical persona evidence, not only display name and username.
- `reply` remains first-class; do not route it through comment-only prompt directives.
- Keep active plans in `/plans`, not `docs/plans`.

## Current Priority Order

1. Fix the raw stage invocation boundary.
2. Enforce strict structured text-flow output.
3. Thread canonical persona evidence into flow audits and fix reply directive routing.
4. Add missing `post_plan` semantic audit/repair.
5. Harden persona-generation strictness and remove legacy memory write surfaces.
6. Improve diagnostics and token/runtime efficiency.
7. Sync docs/examples and add one `test:llm-flows` verification script.

---

## Task 1: Split Raw Stage Invocation From Parsed Preview Orchestration

**Priority:** P0

**Why:** Flow modules currently call `runPersonaInteraction` for main, schema repair, audit, and quality repair stages. The default implementation is `AdminAiControlPlaneStore.runPersonaInteraction()`, which calls `AiAgentPersonaInteractionService.run()` and then parses/audits based on `taskType`. That makes audit-stage JSON vulnerable to being rejected as generated comment/reply/post-body content. It also duplicates audit/repair ownership between the service and flow modules.

**Files:**

- Create: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Test: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Step 1: Write failing tests**

- Add a store-backed flow test where `comment.main` succeeds, `comment_audit` returns audit JSON, and the flow module receives that audit JSON without `AiAgentPersonaInteractionService` trying to parse it as generated markdown.
- Add the same coverage for `reply_audit` and `post_body_audit`.
- Add a regression proving `runPersonaInteraction` is no longer used as the flow-module stage invoker.

Run:

```bash
npm test -- src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: FAIL until a raw stage invoker exists.

**Step 2: Create a raw stage service**

Add `AiAgentPersonaInteractionStageService` with one job:

- assemble the appropriate prompt blocks for `taskType`
- invoke the selected model
- return raw text, prompt, token budget, model/provider metadata, and finish reason
- do no schema parsing
- do no content audit
- do no quality repair

Recommended return shape:

```ts
export type PersonaInteractionStageResult = {
  assembledPrompt: string;
  rawText: string;
  finishReason: string | null;
  tokenBudget: PreviewResult["tokenBudget"];
  providerId: string | null;
  modelId: string | null;
};
```

**Step 3: Add a store method**

Add `AdminAiControlPlaneStore.runPersonaInteractionStage()` that loads the active control-plane document, providers, models, persona profile, and invocation config, then delegates to `AiAgentPersonaInteractionStageService`.

**Step 4: Update flow module input**

Replace `runPersonaInteraction` in `TextFlowModuleRunInput` with a raw stage callback such as:

```ts
runPersonaInteractionStage(input: {
  personaId: string;
  modelId: string;
  taskType: PromptActionType;
  taskContext: string;
  boardContextText?: string;
  targetContextText?: string;
}): Promise<PersonaInteractionStageResult>;
```

Flow modules parse `rawText` themselves.

**Step 5: Reduce `AiAgentPersonaInteractionService` scope**

Keep `AiAgentPersonaInteractionService.run()` only for direct admin preview compatibility, or rewrite it as a thin wrapper over the shared flow registry. It must not be used inside flow modules.

**Step 6: Verify**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts
```

Expected: PASS.

---

## Task 2: Enforce Strict JSON Output For Text Flows

**Priority:** P1

**Why:** `parseMarkdownActionOutput()` currently treats invalid JSON as raw markdown. That violates the active `comment` / `reply` contract, hides schema failures, and leaves `schemaRepair` counters unused.

**Files:**

- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Modify: `src/lib/ai/prompt-runtime/action-output.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`

**Step 1: Write failing tests**

- Plain prose response for `comment` fails schema validation.
- JSON missing `markdown` fails schema validation.
- JSON with forbidden extra keys fails schema validation.
- Invalid `need_image` / `image_prompt` / `image_alt` combinations fail schema validation if the contract requires consistency.
- First invalid JSON response triggers one schema repair before audit.

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

Expected: FAIL until strict parsing and schema repair are added.

**Step 2: Add strict parser**

Prefer a new parser over changing all legacy call sites at once:

```ts
export function parseStrictMarkdownActionOutput(rawText: string): {
  output: {
    markdown: string;
    imageRequest: MarkdownImageRequest;
  } | null;
  error: string | null;
};
```

Rules:

- require exactly one JSON object
- require `markdown` string
- require `need_image` boolean
- require `image_prompt` and `image_alt` keys with string or null values
- reject extra top-level keys
- reject empty markdown

**Step 3: Wire schema repair**

In `single-stage-writer-flow.ts`:

- parse main output with strict parser
- if invalid, call one schema-repair prompt using the same raw stage invoker
- increment `attempt.schemaRepair`
- parse repaired output strictly
- audit only after strict schema passes

**Step 4: Update preview-only parsing deliberately**

If `execution-preview.ts` still needs to display legacy raw markdown, keep that behavior local to preview display and do not reuse it for runtime generation contracts.

**Step 5: Verify**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

Expected: PASS.

---

## Task 3: Thread Canonical Persona Evidence And Fix Reply Directives

**Priority:** P1

**Why:** Flow-level audit prompts use `buildFallbackPersonaEvidence()`, which only carries display name, username, and empty doctrine arrays. The active plans require compact canonical evidence for `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit`. Separately, `AiAgentPersonaInteractionService` supports `reply` in types but still maps reply directive derivation to comment.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Test: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Step 1: Write failing tests**

- Flow audit prompt includes reference source names from `persona_core`.
- Flow audit prompt includes non-empty doctrine evidence when source fields exist.
- Reply assembled prompt includes thread-native reply directives and anti-style guidance.
- No flow audit prompt contains "No value-fit doctrine available" when persona core has enough source signal.

**Step 2: Add persona evidence to flow input**

Add `personaEvidence: PromptPersonaEvidence` to `TextFlowModuleRunInput`.

Build it once in the raw stage service or generator dependency layer using:

```ts
buildPersonaEvidence({
  displayName,
  profile: normalizeCoreProfile(personaCore).profile,
  personaCore,
});
```

**Step 3: Remove fallback evidence from real flow execution**

Keep fallback evidence only for isolated tests if necessary. Runtime and preview flow modules should use the canonical evidence from input.

**Step 4: Fix reply directive mapping**

In `AiAgentPersonaInteractionService` and the new stage service, map:

- `post`, `post_plan`, `post_body` -> `post`
- `reply` -> `reply`
- `comment` -> `comment`

**Step 5: Verify**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

Expected: PASS.

---

## Task 4: Add `post_plan` Semantic Audit And Repair

**Priority:** P1

**Why:** The post planning path currently performs schema validation, deterministic quality checks, and hard-gate ranking. It does not run the planned compact semantic audit/repair before gate selection. The deterministic gate cannot judge all planning semantics, especially novelty reasoning, persona-native angle fit, and whether the body outline would produce a useful post.

**Files:**

- Create: `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- Create: `src/lib/ai/prompt-runtime/post-plan-audit.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`

**Step 1: Define audit contract**

Recommended audit checks:

```ts
type PostPlanAuditChecks = {
  candidate_count: "pass" | "fail";
  board_fit: "pass" | "fail";
  novelty_evidence: "pass" | "fail";
  persona_posting_lens_fit: "pass" | "fail";
  body_outline_usefulness: "pass" | "fail";
  no_model_owned_final_selection: "pass" | "fail";
};
```

The audit output must include:

- `passes`
- `issues`
- `repairGuidance`
- `checks`

Reject extra top-level keys.

**Step 2: Write failing tests**

- Audit prompt tells the model it is reviewing a compact packet.
- Parser rejects missing checks and extra keys.
- Failed planning audit triggers one planning repair before hard-gate evaluation.
- Repaired plan re-runs deterministic validation and audit.
- Terminal planning audit failure carries flow diagnostics.

**Step 3: Wire into `post-flow-module.ts`**

Order:

```text
post_plan.main
-> schema_validate
-> schema_repair?
-> deterministic_checks
-> planning_audit
-> planning_repair?
-> recheck deterministic checks
-> recheck planning audit
-> hard gate + deterministic ranking
-> fresh regenerate once if no candidate passes
```

**Step 4: Update diagnostics**

Add `planningAudit` to `FlowDiagnostics` with:

- `contract: "post_plan_audit"`
- `status`
- `repairApplied`
- `issues`
- `checks`

**Step 5: Verify**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/post-plan-audit.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts
```

Expected: PASS.

---

## Task 5: Harden Persona-Generation Contracts

**Priority:** P1

**Why:** Persona generation is correctly simplified to two stages, but its parser still permits compatibility behavior: wrapper unwrapping, fenced JSON extraction, aliases such as `creator_admiration`, status coercion, object spreads that preserve extra keys, and semantic audits that can pass open when audit output is empty or invalid. The active stage contract forbids extra keys and current development does not require backward compatibility.

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Modify: `src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts`
- Modify: `src/lib/ai/admin/persona-save-payload.ts`

**Step 1: Write failing tests**

- `seed` rejects wrapper objects.
- `seed` and `persona_core` reject fenced JSON for canonical stage outputs.
- `persona_core` rejects direct `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit` keys.
- Nested sections reject forbidden extra keys.
- `creator_admiration` alias is rejected; only `creator_affinity` is accepted.
- `task_style_matrix.comment.body_shape` alias is rejected; only `feedback_shape` is accepted.
- Invalid or empty semantic audit output fails closed.
- `createPersona` and `patchPersonaProfile` no longer accept `personaMemories` in generate-persona save/update payloads.

**Step 2: Add exact-key validators**

Add helpers in `persona-generation-contract.ts`:

```ts
function assertExactKeys(
  record: Record<string, unknown>,
  fieldPath: string,
  allowed: string[],
): void;
```

Use it for:

- `seed`
- `persona_core`
- each nested section
- semantic audit JSON

Do not preserve `...root` in parsed output where it can carry forbidden keys into persistence.

**Step 3: Remove compatibility aliases**

Delete or reject:

- `unwrapPersonaStageRoot`
- `creator_admiration`
- `comment.body_shape`
- status coercion that rewrites unknown status values
- fenced JSON acceptance for canonical stages

If prompt-assist tooling still needs fenced JSON extraction, keep that behavior scoped to prompt-assist parsing, not persona-generation canonical stages.

**Step 4: Fail semantic audits closed**

Set fail-closed behavior for:

- `seed_originalization_audit`
- `seed_reference_source_audit`
- `persona_core_quality_audit`

Empty, invalid, or missing audit JSON should produce quality issues and enter repair, not pass the candidate.

**Step 5: Remove legacy generated-memory write surface**

Preview/save helpers already omit generated memories. Remove `personaMemories` from create/update contracts used by generate-persona save/update. Keep dedicated memory-module APIs untouched.

**Step 6: Verify**

Run:

```bash
npm test -- src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/admin/control-plane-store.patch-persona-profile.test.ts
```

Expected: PASS.

---

## Task 6: Improve Failure Diagnostics And Runtime Observability

**Priority:** P2

**Why:** `FlowDiagnostics` is useful on success, but terminal failures generally throw plain errors and lose stage-local diagnostics. Operators need to know whether a flow failed due to transport, schema validation, deterministic gate, audit, repair, truncation, or render validation.

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`
- Test: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Test: `src/lib/ai/agent/execution/execution-preview.test.ts`

**Step 1: Define typed failure**

Add:

```ts
export class TextFlowExecutionError extends Error {
  readonly flowKind: TextFlowKind;
  readonly diagnostics: FlowDiagnostics;
  readonly causeCategory:
    | "transport"
    | "empty_output"
    | "schema_validation"
    | "deterministic_gate"
    | "semantic_audit"
    | "quality_repair"
    | "render_validation";
}
```

**Step 2: Populate diagnostics on failure**

For every terminal failure:

- set `finalStatus: "failed"`
- set `terminalStage`
- include current attempts
- include stage result status
- include audit/gate details available so far

**Step 3: Surface in preview/runtime**

`persona-task-generator` should preserve the typed diagnostics for logs/preview surfaces instead of collapsing to only `error.message`.

**Step 4: Verify**

Run:

```bash
npm test -- src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/agent/execution/execution-preview.test.ts
```

Expected: PASS.

---

## Task 7: Optimize Audit/Repair Prompt Cost

**Priority:** P2

**Why:** After Task 1, audit and repair stages can use a lean stage prompt instead of running through the full writer-family prompt shell. That reduces tokens, avoids conflicting output constraints, and makes audit contracts easier to reason about.

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Test: `src/lib/ai/prompt-runtime/runtime-budgets.test.ts` if a test exists, otherwise create it.

**Step 1: Add explicit stage purpose**

Extend raw stage invocation input with:

```ts
stagePurpose: "main" | "schema_repair" | "audit" | "quality_repair";
```

**Step 2: Use lean prompt blocks for audit**

For `audit` and `quality_repair`:

- include `system_baseline`
- include `global_policy`
- include stage-specific `taskContext`
- include board/target context only if the stage prompt already asks for it
- omit writer examples and full voice-contract blocks unless explicitly needed

**Step 3: Add stage budgets**

Add budget profiles for:

- `post_plan_audit`
- `post_body_audit`
- `comment_audit`
- `reply_audit`
- `text_schema_repair`
- `text_quality_repair`

**Step 4: Verify**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/prompt-runtime/runtime-budgets.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

Expected: PASS.

---

## Task 8: Sync Active Docs And Examples

**Priority:** P2

**Why:** Several active plans still mark completed audit work as partial or blocked, while `audit-remediation-plan.md` has a completed checklist. `flow-audit-repair-examples.md` still teaches old single `persona_fit` shapes for comment/reply examples. This creates implementation drift for future agents.

**Files:**

- Modify: `plans/ai-agent/llm-flows/llm-flows-integration-plan.md`
- Modify: `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- Modify: `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- Modify: `plans/ai-agent/llm-flows/reference-role-doctrine-plan.md`
- Modify: `plans/ai-agent/llm-flows/audit-remediation-plan.md`
- Modify: `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`
- Modify: `tasks/todo.md`

**Step 1: Update status markers**

- Replace stale `⚠️ PARTIAL` markers for completed audit-remediation work.
- Mark `audit-remediation-plan.md` complete and superseded by this plan for future hardening.
- Keep `post_plan` audit as a remaining gap until Task 4 lands.

**Step 2: Update examples**

Refresh comment/reply audit examples to include:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

Remove old `persona_fit` example output from active examples.

**Step 3: Verify docs**

Run:

```bash
rg -n 'PARTIAL|not wired|single `persona_fit`|single persona_fit|Blocked on Tasks 3|Blocked on Task 4' plans/ai-agent/llm-flows
rg -n 'persona_fit' plans/ai-agent/llm-flows/flow-audit-repair-examples.md
```

Expected:

- only intentional historical references remain
- no active examples teach old `persona_fit` JSON contracts

---

## Task 9: Consolidate LLM-Flow Verification

**Priority:** P2

**Why:** `npm run test:core` covers important contracts, but it omits several active LLM-flow tests. The final integration-plan command also omits flow-module tests. Add a single script so future work has one correct verification target.

**Files:**

- Modify: `package.json`
- Modify: `docs/dev-guidelines/08-llm-json-stage-contract.md`
- Modify: `plans/ai-agent/llm-flows/llm-flows-integration-plan.md`
- Modify: `plans/ai-agent/llm-flows/audit-remediation-plan.md`
- Modify: `tasks/todo.md`

**Step 1: Add `test:llm-flows`**

Recommended script:

```json
"test:llm-flows": "vitest run src/lib/ai/prompt-runtime/action-output.test.ts src/lib/ai/prompt-runtime/json-parse-utils.test.ts src/lib/ai/prompt-runtime/prompt-builder.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts src/lib/ai/prompt-runtime/post-plan-audit.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts src/lib/ai/admin/persona-generation-contract.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts src/lib/ai/core/runtime-core-profile.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/agent/execution/persona-task-generator.test.ts src/lib/ai/agent/execution/persona-task-persistence-service.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts"
```

Add `post-plan-audit.test.ts` after Task 4 creates it. Until then, omit that path or add it in Task 4.

**Step 2: Update `verify`**

After the script is stable:

```json
"verify": "npm run typecheck && npm run lint && npm run test:llm-flows"
```

**Step 3: Verify**

Run:

```bash
npm run test:llm-flows
npm run verify
```

Expected: PASS.

---

## Final Verification

After all tasks land, run:

```bash
npm run test:llm-flows
npm run typecheck
npm run lint
npm run verify
```

Expected:

- LLM-flow tests pass.
- TypeScript passes through the project-level `typecheck` script.
- Lint has no new warnings from touched files.
- Active LLM-flow docs no longer contradict implementation.

## Completion Criteria

- Flow modules use a raw stage invoker, not the parsed/audited preview service.
- No text-flow audit/repair stage is parsed as main generated content.
- `comment` and `reply` require strict JSON output and exercise schema repair.
- Flow audits use canonical persona evidence with reference names and doctrine signals.
- `reply` writer prompts use reply-specific directives.
- `post_plan` has semantic audit/repair before hard-gate selection.
- Persona generation rejects forbidden extra keys and fails semantic audits closed.
- Legacy generate-persona memory write surfaces are removed from create/update payloads.
- Failure diagnostics survive terminal errors.
- Active docs and examples match implementation.
- `npm run test:llm-flows` exists and is part of the standard verification path.
