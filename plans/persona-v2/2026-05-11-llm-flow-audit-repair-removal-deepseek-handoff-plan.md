# LLM Flow Audit/Repair Removal DeepSeek Handoff Plan

> **For DeepSeek:** implement this task-by-task. Treat this as the new source of truth for llm-flow simplification. Remove `audit`, `schema_repair`, `quality_repair`, and finish-continuation paths. Keep shared structured/schema infrastructure, deterministic syntax salvage, and shared schema-gate `field_patch`. Where flows previously exposed repair stages, replace them with explicit attempt/retry counting and failure diagnostics instead.

**Goal:** Remove audit, `schema_repair`, and `quality_repair` from all active llm flows, including intake flow, while keeping shared structured/schema infrastructure, deterministic syntax salvage, plus shared `field_patch`, and hand DeepSeek one consolidated file map for the runtime, admin preview, contract, and docs fallout.

**Architecture:** All active llm flows collapse to a `main -> schema_gate(with deterministic syntax salvage, loose normalization, and field_patch) -> deterministic app checks -> consume or fail` shape. `field_patch` remains an internal shared schema-gate primitive, not a public prompt stage. Post/comment/reply/persona-generation/intake stop running separate `audit`, `schema_repair`, `quality_repair`, finish-continuation, and audit-driven rewrite loops. Preview/debug output should report schema-gate behavior, attempt/retry counts, and deterministic failures, not semantic audit verdicts.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 structured output via `Output.object({ schema })`, Zod, shared json-repair utilities, prompt-runtime flow builders, admin control-plane previews, Vitest.

---

## Scope And Assumptions

- Interpret the corrected target literally: keep only shared `field_patch`; remove `audit`, `schema_repair`, and `quality_repair`.
- Remove these active runtime concepts from llm flows:
  - `audit`
  - `schema_repair`
  - `quality_repair`
  - finish-continuation
- Keep these concepts:
  - code-owned Zod schemas
  - deterministic syntax salvage for structurally incomplete JSON prefixes
  - loose normalization for harmless overflow such as extra keys and `metadata.probability`
  - shared structured invocation
  - shared schema gate
  - shared `field_patch` for parseable schema-invalid JSON on allowlisted paths only
  - app-owned deterministic checks and hard gates
  - provider/runtime retries at the transport layer if already part of shared invocation config
  - explicit attempt/retry counting in diagnostics where flows still retry main generation
- Do not keep backward-compatibility shims for old preview contracts or prompt-stage enums. This repo is in active migration mode.

## Target Runtime Shape

```text
main structured call
  -> shared schema gate
       -> prefer provider object
       -> parse raw text if needed
       -> if structurally incomplete: deterministic syntax salvage
       -> loose normalize
       -> validate original schema
       -> if parseable schema-invalid and allowlisted: field_patch
       -> revalidate original schema
  -> deterministic app checks
  -> consume typed output or fail
```

Rules:

- Remove standalone prompt stages for `schema_repair`, `audit`, and `quality_repair`.
- No finish-continuation callback in the active flow path.
- Keep deterministic syntax salvage before `field_patch`.
- `field_patch` starts only after the payload is parseable JSON.
- No semantic audit JSON contracts.
- No audit-specific prompt packets, repair guidance packets, or repair-applied diagnostics.
- If main output is schema-invalid and cannot be fixed by allowlisted `field_patch`, fail closed with schema/debug metadata.
- If raw output remains unparseable after deterministic syntax salvage, fail closed with schema/debug metadata.
- If a flow still retries, diagnostics should report attempt/retry counts directly instead of exposing retired repair-stage names.

## Source Documents To Reconcile Or Supersede

These active references still describe audit/repair behavior and must either be updated or clearly superseded by this plan:

- `docs/dev-guidelines/08-llm-json-stage-contract.md`
- `docs/ai-agent/llm-flows/README.md`
- `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`
- `docs/ai-agent/llm-flows/persona-generation-contract.md`
- `plans/persona-v2/2026-05-07-persona-core-v2-prompt-examples-deepseek-handoff-plan.md`
- `plans/persona-v2/2026-05-07-schema-repair-before-audit-plan.md`
- `plans/persona-v2/2026-05-08-invokellm-structured-schema-gate-deepseek-plan.md`
- `plans/persona-v2/2026-05-08-deepseek-schema-gate-implementation-review-plan.md`
- `plans/persona-v2/persona-prompt-architecture-current-map.md`

Historical archive docs may stay archived, but active `/plans` and current `/docs/ai-agent/llm-flows` references must stop instructing DeepSeek to add audit/repair back.

## Full Related File List

This is the working file inventory for the migration. Use it as the handoff map; do not narrow scope to only one module.

### Runtime Flow Entry Points

- `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- `src/lib/ai/agent/execution/flows/comment-flow-module.ts`
- `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/reply-flow-module.ts`
- `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- `src/lib/ai/agent/execution/flows/types.ts`
- `src/lib/ai/agent/execution/persona-interaction-service.ts`
- `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- `src/lib/ai/agent/execution/persona-task-generator.ts`
- `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- `src/lib/ai/agent/execution/execution-preview.ts`
- `src/lib/ai/agent/intake/intake-stage-llm-service.ts`
- `src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`
- `src/lib/ai/agent/intake/intake-preview.ts`
- `src/lib/ai/agent/intake/opportunity-store.ts`

### Shared Structured-LLM And JSON Repair

- `src/lib/ai/llm/invoke-structured-llm.ts`
- `src/lib/ai/llm/invoke-structured-llm.test.ts`
- `src/lib/ai/json-repair/schema-gate.ts`
- `src/lib/ai/json-repair/schema-gate.test.ts`
- `src/lib/ai/json-repair/schema-gate-contracts.ts`
- `src/lib/ai/json-repair/schema-gate-adapters.ts`
- `src/lib/ai/json-repair/field-patch-schema.ts`
- `src/lib/ai/json-repair/response-finisher.ts`
- `src/lib/ai/json-repair/response-finisher.test.ts`

### Prompt Runtime And Stage Contracts

- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`
- `src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`
- `src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts`
- `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- `src/lib/ai/prompt-runtime/runtime-budgets.test.ts`
- `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- `src/lib/ai/prompt-runtime/post-plan-audit.test.ts`
- `src/lib/ai/prompt-runtime/post-body-audit.ts`
- `src/lib/ai/prompt-runtime/post-body-audit.test.ts`
- `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- `src/lib/ai/prompt-runtime/comment-flow-audit.test.ts`
- `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- `src/lib/ai/prompt-runtime/reply-flow-audit.test.ts`
- `src/lib/ai/prompt-runtime/persona-audit-shared.ts`
- `src/lib/ai/prompt-runtime/persona-output-audit.ts`
- `src/lib/ai/stage-debug-records.ts`

### Persona Generation And Admin Preview

- `src/lib/ai/admin/persona-generation-preview-service.ts`
- `src/lib/ai/admin/persona-generation-preview-service.test.ts`
- `src/lib/ai/admin/persona-generation-contract.ts`
- `src/lib/ai/admin/persona-generation-prompt-template.ts`
- `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- `src/lib/ai/admin/persona-generation-token-budgets.ts`
- `src/lib/ai/admin/persona-generation-token-budgets.test.ts`
- `src/lib/ai/admin/control-plane-contract.ts`
- `src/lib/ai/admin/control-plane-store.ts`
- `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- `src/lib/ai/admin/interaction-preview-mock.ts`
- `src/mock-data/interaction-preview.json`
- `src/components/admin/control-plane/PreviewPanel.test.ts`
- `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`
- `src/app/api/admin/ai/persona-generation/preview/route.test.ts`

### Current Docs And Plans

- `docs/dev-guidelines/08-llm-json-stage-contract.md`
- `docs/ai-agent/llm-flows/README.md`
- `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`
- `docs/ai-agent/llm-flows/persona-generation-contract.md`
- `plans/persona-v2/2026-05-07-persona-core-v2-prompt-examples-deepseek-handoff-plan.md`
- `plans/persona-v2/2026-05-07-schema-repair-before-audit-plan.md`
- `plans/persona-v2/2026-05-08-invokellm-structured-schema-gate-deepseek-plan.md`
- `plans/persona-v2/2026-05-08-deepseek-schema-gate-implementation-review-plan.md`
- `plans/persona-v2/persona-prompt-architecture-current-map.md`

## Task 1: Collapse Public Stage Contracts To Main-Only

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.ts`
- Modify: `src/lib/ai/prompt-runtime/runtime-budgets.test.ts`

**Work:**

1. Remove `audit`, `schema_repair`, and `quality_repair` from `PersonaInteractionStagePurpose`.
2. Make the Persona v2 prompt-family builder assemble only `main` stage blocks for active llm flows.
3. Delete schema-repair-only, audit-only, and quality-repair-only block ordering, policy builders, and packet branches.
4. Remove audit packet generation from runtime persona packets; keep only packets needed for `main`.
5. Rename or simplify token budgets so they no longer imply retired schema-repair/audit/quality-repair stages.
6. Keep schema-gate debug metadata available inside the main stage response.
7. Where callers still do retries, track them with explicit `main`/`regenerate` attempt counts instead of stage-purpose repair labels.

**Verification:**

- `rg -n 'stagePurpose: "audit"|stagePurpose: "schema_repair"|quality_repair|flow: "audit"' src/lib/ai/agent/execution src/lib/ai/prompt-runtime`
- `npx vitest run src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts src/lib/ai/prompt-runtime/runtime-budgets.test.ts`

## Task 2: Remove Audit/Repair Loops From Post, Comment, And Reply Runtime Flows

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/types.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.test.ts`
- Modify: `src/lib/ai/agent/execution/execution-preview.ts`

**Work:**

1. Delete post-plan and post-body audit calls, quality-repair calls, and audit-after-repair loops.
2. Delete comment/reply audit and quality-repair loops in `single-stage-writer-flow.ts`.
3. Remove prompt-level `schema_repair` retries for post/comment/reply.
4. Keep deterministic app checks that are code-owned:
   - post-plan candidate validation and selection
   - post-body markdown/tag requirements
   - comment/reply non-empty markdown checks
5. Simplify `FlowDiagnostics` so it no longer exposes `planningAudit`, `bodyAudit`, or comment/reply `audit`.
6. Replace repair-stage accounting with explicit attempt/retry counters for `main` and any regenerate path; remove counters and diagnostics tied to schema-repair, semantic audit, or quality repair.
7. Keep `TextFlowExecutionError` cause categories aligned to the new world; `semantic_audit`, `quality_repair`, and schema-repair-specific failure paths should disappear from these flows.

**Verification:**

- `rg -n 'planningAudit|bodyAudit|repairApplied|semantic_audit|quality_repair|schema_repair' src/lib/ai/agent/execution/flows src/lib/ai/agent/execution`
- `npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts`

## Task 3: Remove Audit/Repair From Intake Flow

**Files:**

- Modify: `src/lib/ai/agent/intake/intake-stage-llm-service.ts`
- Modify: `src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`
- Modify if needed: `src/lib/ai/agent/intake/intake-preview.ts`

**Work:**

1. Remove intake-only `schema_repair`, `quality_audit`, and `quality_repair` phases from `StagePhase`.
2. Delete `JsonAuditResultSchema`, `parseAuditResult`, `buildQualityAuditPrompt`, `buildQualityRepairPrompt`, and `runQualityAudit`.
3. Make intake stages rely on:
   - one `main` structured call
   - shared schema gate
   - deterministic validation only
4. Fail closed on deterministic validation errors after schema-gate completion; do not launch a follow-up schema-repair, audit, or quality-rewrite stage.
5. Remove intake-specific prompt text that tells the model to emit audit or repair payloads.
6. Keep structured output schemas for `opportunities` and `candidates`, but remove audit/schema-repair schema routing from `resolveIntakeSchemaGate`.
7. Remove intake tests that assert `schema_repair`, `quality_audit`, or `quality_repair` call sequences, and replace them with tests that assert main-only behavior plus deterministic failure paths and retry counts if applicable.

**Verification:**

- `rg -n 'schema_repair|quality_audit|quality_repair|repair_instructions|stage_audit' src/lib/ai/agent/intake`
- `npx vitest run src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`

## Task 4: Strip Persona Generation Down To Main Plus FieldPatch

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-token-budgets.ts`
- Modify: `src/lib/ai/admin/persona-generation-token-budgets.test.ts`
- Modify: `src/app/api/admin/ai/persona-generation/preview/route.test.ts`

**Work:**

1. Delete semantic audit schemas, semantic audit prompt builders, audit helpers, quality-repair delta parsing, and quality-repair retry loops from persona generation preview.
2. Keep one structured `persona_core_v2` main stage using code-owned schema plus shared schema gate.
3. Keep deterministic quality gates only if they are app-owned and non-LLM:
   - English-only enforcement
   - allowed reference-name filtering or normalization
   - invariant checks that do not require a semantic audit model call
4. If deterministic quality checks fail after schema-gate completion, fail closed instead of launching a second LLM audit or quality-repair stage.
5. Rename budgets so they describe `main`, `retry`, and shared-structured behavior only; remove schema-repair/audit/quality-repair budget constants.
6. Keep stage debug output focused on main attempt plus schema-gate attempts.

**Verification:**

- `rg -n 'semantic_audit|quality repair|repairGuidance|passes: z.boolean|qualityRepairOutputTokens|qualityAuditOutputTokens' src/lib/ai/admin`
- `npx vitest run src/lib/ai/admin/persona-generation-preview-service.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/lib/ai/admin/persona-generation-token-budgets.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts`

## Task 5: Keep Shared Structured-LLM, Syntax Salvage, And FieldPatch In Shared Structured Invocation

**Files:**

- Modify: `src/lib/ai/llm/invoke-structured-llm.ts`
- Modify: `src/lib/ai/llm/invoke-structured-llm.test.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.test.ts`
- Modify: `src/lib/ai/json-repair/schema-gate-contracts.ts`
- Modify: `src/lib/ai/json-repair/schema-gate-adapters.ts`
- Modify: `src/lib/ai/json-repair/field-patch-schema.ts`
- Modify or retire: `src/lib/ai/json-repair/response-finisher.ts`
- Modify or retire: `src/lib/ai/json-repair/response-finisher.test.ts`

**Work:**

1. Remove finish-continuation support from `invokeStructuredLLM`, schema-gate contracts, and adapters.
2. Keep deterministic syntax salvage in the active schema gate path, but limit it to structure-only closure for incomplete prefixes.
3. Keep shared behavior for:
   - provider object preference
   - raw-text extraction when needed
   - deterministic syntax salvage before parse success
   - loose normalization
   - original-schema validation
   - allowlisted `field_patch`
   - final validation plus debug metadata
4. Make schema-gate failures fail closed once syntax salvage and `field_patch` are exhausted or unavailable.
5. Keep `field_patch` generic and flow-agnostic; do not move flow-specific prompt logic into shared repair code.
6. Update tests so deterministic syntax salvage plus `field_patch` are the only surviving repair mechanisms and debug output still carries attempt metadata.

**Verification:**

- `rg -n 'finish_continuation|invokeFinishContinuation' src/lib/ai/llm src/lib/ai/json-repair`
- `npx vitest run src/lib/ai/llm/invoke-structured-llm.test.ts src/lib/ai/json-repair/schema-gate.test.ts`

## Task 6: Remove Audit/Repair From Preview Contracts, Mocks, And Admin UI Expectations

**Files:**

- Modify: `src/lib/ai/admin/control-plane-contract.ts`
- Modify: `src/lib/ai/admin/control-plane-store.ts`
- Modify: `src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts`
- Modify: `src/lib/ai/admin/interaction-preview-mock.ts`
- Modify: `src/mock-data/interaction-preview.json`
- Modify: `src/components/admin/control-plane/PreviewPanel.test.ts`
- Modify: `src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

**Work:**

1. Remove `auditDiagnostics` from the active preview contract if it is no longer emitted.
2. Remove `repairApplied`, audit check payloads, and audit-mode status from preview mocks and test fixtures.
3. Replace audit-focused preview assertions with schema-gate/debug-focused assertions where useful.
4. Make preview UI/test expectations reflect the simplified contract rather than hiding stale audit fields behind `null`.

**Verification:**

- `rg -n 'auditDiagnostics|repairApplied|planningAudit|bodyAudit' src/lib/ai/admin src/components/admin src/app/api/admin/ai`
- `npx vitest run src/lib/ai/admin/control-plane-store.preview-persona-interaction.test.ts src/components/admin/control-plane/PreviewPanel.test.ts src/app/api/admin/ai/persona-interaction/preview/route.test.ts`

## Task 7: Rewrite Current Reference Docs So DeepSeek Does Not Reintroduce Audit/Repair

**Files:**

- Modify: `docs/dev-guidelines/08-llm-json-stage-contract.md`
- Modify: `docs/ai-agent/llm-flows/README.md`
- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Modify or replace: `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`
- Modify: `docs/ai-agent/llm-flows/persona-generation-contract.md`
- Modify: `plans/persona-v2/2026-05-07-persona-core-v2-prompt-examples-deepseek-handoff-plan.md`
- Modify or archive: `plans/persona-v2/2026-05-07-schema-repair-before-audit-plan.md`
- Modify: `plans/persona-v2/2026-05-08-invokellm-structured-schema-gate-deepseek-plan.md`
- Modify: `plans/persona-v2/2026-05-08-deepseek-schema-gate-implementation-review-plan.md`
- Modify: `plans/persona-v2/persona-prompt-architecture-current-map.md`

**Work:**

1. Rewrite the stage model so active llm flows no longer describe `schema_repair`, `quality_audit`, `quality_repair`, or finish continuation as standard runtime steps.
2. Replace audit/repair prompt examples with syntax-salvage plus `field_patch` examples, or retire the file if the examples are now misleading.
3. Make active DeepSeek handoff docs explicitly say that shared structured/schema infrastructure, deterministic syntax salvage, and `field_patch` remain, while `schema_repair`, `audit`, and `quality_repair` are retired.
4. Mark older audit-centric plans as superseded or move them out of the active path if they are now architecture drift.
5. Keep archived docs archived; do not spend scope rewriting historical implementation records unless they are still linked as current guidance.

**Verification:**

- `rg -n 'schema_repair|quality_audit|quality_repair|finish_continuation|audit prompt|semantic audit' docs/dev-guidelines docs/ai-agent/llm-flows plans/persona-v2`
- manual diff review of active docs only

## Final Verification Gate

Run the focused checks below before calling the migration complete:

```bash
npm run verify
npx vitest run \
  src/lib/ai/agent/execution/flows/post-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/comment-flow-module.test.ts \
  src/lib/ai/agent/execution/flows/reply-flow-module.test.ts \
  src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts \
  src/lib/ai/agent/intake/intake-stage-llm-service.test.ts \
  src/lib/ai/admin/persona-generation-preview-service.test.ts \
  src/lib/ai/json-repair/schema-gate.test.ts \
  src/lib/ai/llm/invoke-structured-llm.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts \
  src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

Then confirm with grep that active sources no longer expose the retired stage vocabulary:

```bash
rg -n 'stagePurpose: "audit"|stagePurpose: "schema_repair"|stagePurpose: "quality_repair"|planningAudit|bodyAudit|auditDiagnostics|finish_continuation|quality_audit|quality_repair|repair_instructions' src docs/ai-agent/llm-flows plans/persona-v2
```

Expected result: no matches for retired schema-repair/audit/quality-repair vocabulary in active runtime code or current reference docs, except possibly archived docs that are intentionally historical. Deterministic syntax-salvage helpers may still remain under shared json-repair files.
