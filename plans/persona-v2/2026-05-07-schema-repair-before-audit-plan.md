# Phase 2.7: Shared JSON Schema Gate Before Audit Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Status:** Superseded for active implementation. This plan predates the removal of prompt-level audit/repair stages and still assumes finish-continuation. Use `docs/dev-guidelines/08-llm-json-stage-contract.md` plus `plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md` instead.

**Goal:** Make the shared schema gate mandatory for every app-owned structured JSON LLM output, with Persona Core v2 prompt-family flows as the first integration target, so audits only judge output quality after JSON parsing and schema validation already pass.

**Architecture:** Follow `docs/dev-guidelines/08-llm-json-stage-contract.md`: raw provider invocation may pass `Output.object({ schema })`, but schema validation and repair live in an opt-in `invokeStructuredLLM` wrapper. The wrapper calls the shared schema gate with the same code-owned Zod schema, validates/repairs if needed, and returns a typed valid object or typed schema failure. AI SDK structured-output object generation failures where the provider cannot produce a parsable schema-conforming object are normalized into the same repair route as `finishReason=length`. Prompt text must not contain hardcoded full key/type JSON schema blocks. Only validated objects can enter downstream semantic audit, quality audit, persistence, ranking, cleanup, or automation. Audit never checks schema, required keys, field types, candidate count, parseability, extra generated keys, or metadata shape.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` / `streamText` with `Output.object`, Zod, staged LLM JSON flows, shared JSON repair utilities, Persona Core v2 prompt family builders, Vitest.

---

## Reference Plan

Read the repair section in:

- `docs/dev-guidelines/08-llm-json-stage-contract.md`
- `plans/persona-v2/2026-05-07-one-stage-persona-generation-prompt-simplification-plan.md`
- `plans/persona-v2/2026-05-08-invokellm-structured-schema-gate-deepseek-plan.md`

Reuse these concepts directly:

- `invokeLLMRaw` / `invokeStructuredLLM` layering
- `SharedJsonSchemaGateInput`
- deterministic truncation classification
- `finishReason=length` continuation repair
- schema-name/path-hint continuation prompt backed by code-owned Zod schema
- field-patch fallback
- unknown-path rejection
- immutable-field protection
- loose generated-output handling for extra keys and harmless overlong arrays
- debug metadata for each repair attempt

## Design Position

The pipeline has two different gates:

1. **Schema gate:** parse, validate, and repair JSON shape.
2. **Quality gate:** audit whether the already-valid output is good enough.

Do not merge these gates.

Why:

- Schema repair needs exact schema paths, parse errors, previous output, code-owned Zod schemas, and repair mechanics.
- Quality audit needs persona packet, board context, target context, generated content, and quality standards.
- Audits become noisy when they inspect keys/types that deterministic parsers already checked.
- Quality repair should only run after audit fails, not after schema validation fails.
- The same schema gate should serve every app-owned structured JSON-output stage, not only Persona v2, because parse/validate/repair mechanics are flow-agnostic.

## Target Flow

```text
llm_json_stage with code-owned Zod schema
  -> invokeStructuredLLM
  -> invokeLLMRaw with Output.object({ schema })
  -> shared_json_schema_gate.extract_normalize_validate
    -> if valid: downstream stage
    -> if invalid and finishReason=length: finish_continuation -> extract_normalize_validate again
       -> if valid: downstream stage
       -> if parseable but schema-invalid: field_patch -> extract_normalize_validate again
    -> if AI SDK object generation error says provider failed to generate a parsable schema-conforming object:
       normalize as finishReason=length-equivalent -> finish_continuation if usable text exists
    -> if invalid and field repairable: field_patch -> extract_normalize_validate again
    -> if still invalid: typed schema failure, no downstream audit/persistence
  -> optional_quality_or_semantic_audit
    -> if quality pass: persist/preview
    -> if quality fail: quality_repair with same code-owned output schema
    -> shared_json_schema_gate on repaired output
    -> quality_audit on repaired valid output
```

Hard rule:

- No invalid or unparseable model output may enter audit.
- No audit stage may validate generated-output schema.
- No app-owned structured LLM JSON output should bypass `invokeStructuredLLM` / the shared schema gate before app-owned logic consumes it.
- Repair is loopable but bounded: every repair attempt returns to extraction, parse, and schema validation; downstream stages run only after validation passes.

## Flow Coverage

The shared schema gate applies to every app-owned LLM output that declares a code-owned schema and is consumed as JSON, including:

- Persona generation
- Persona prompt-family interaction flows
- Semantic audits when their output is consumed as app-owned audit JSON
- Interaction flow audits when their output is consumed as app-owned audit JSON
- Quality repairs
- Intake scoring and selectors
- Ranking, cleanup, and downstream automation stages
- Any future admin or runtime LLM stage that emits JSON

Persona Core v2 first integration targets:

- Persona Core v2 generation output before preview, save payload assembly, or semantic quality checks.
- `post_plan.main` before `post_plan.audit`
- `post_body.main` before `post_body.audit`
- `comment.main` before `comment.audit`
- `reply.main` before `reply.audit`
- every quality-repair output before its follow-up audit

Do not build a Persona-only repair framework. Persona v2 may have a thin adapter for flow schemas, but parsing, finish repair, field patch repair, debug metadata, and failure typing belong in the shared JSON repair layer.

Persona generation is not exempt:

- The one-stage Persona Core v2 generation flow must use the same shared schema gate.
- Missing Persona Core v2 fields, including nested required fields, should be repaired through the same field-patch loop when the partial object is parseable and the missing paths are allowlisted.
- The persona generation adapter supplies the Persona Core v2 schema, validation rules, allowed repair paths, and immutable paths.
- The shared repair module must not contain Persona-specific schema knowledge.

## Schema Inputs

The shared gate receives schema data from the calling flow. For Persona v2 interaction flows, use code-owned schemas instead of static prompt key/type contracts:

- `PostPlanOutputSchema`
- `PostBodyOutputSchema`
- `CommentOutputSchema`
- `ReplyOutputSchema`

The shared schema gate should receive the Zod schema and derived path metadata:

```ts
import type { z } from "zod";

type SharedJsonSchemaGateInput = {
  flowId: string;
  stageId: string;
  rawText: string;
  rawObject?: unknown;
  finishReason: string | null;
  generationErrorName?: string | null;
  generationErrorMessage?: string | null;
  schemaName: string;
  schema: z.ZodType;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
  invokeFieldPatch?: (input: FieldPatchInvocationInput) => Promise<FieldPatchInvocationResult>;
  invokeFinishContinuation?: (
    input: FinishContinuationInvocationInput,
  ) => Promise<FinishContinuationInvocationResult>;
};
```

Persona v2 adapters can map this to:

```ts
type PersonaV2SchemaGateContext = {
  flow: "post_plan" | "post_body" | "comment" | "reply";
  stage: "main" | "quality_repair";
};
```

Every schema adapter must include missing-field repair paths:

- Required top-level fields.
- Required nested object fields.
- Required array fields where the whole array can be replaced safely.
- Required leaf fields under arrays when path mapping is deterministic.

If a missing path is not allowlisted, the schema gate must fail with a typed schema error instead of asking the model for an unconstrained patch.

## Flow-Specific Repair Paths

### `post_plan`

Allowed repair paths:

- `candidates`
- `candidates.*.title`
- `candidates.*.idea`
- `candidates.*.outline`
- `candidates.*.persona_fit_score`
- `candidates.*.novelty_score`

Schema-only rules:

- `candidates` must be an array.
- Candidate fields must validate through `PostPlanOutputSchema`.
- Candidate count is schema-stage responsibility, not audit responsibility.

### `post_body`

Allowed repair paths:

- `body`
- `tags`
- `need_image`
- `image_prompt`
- `image_alt`
- `metadata`
- `metadata.probability`

Schema-only rules:

- `body` must be a string containing markdown text.
- `metadata.probability` must parse as an integer from 0 to 100, or parser policy may default invalid values to `0` if the code-owned schema behavior keeps that default.

### `comment`

Allowed repair paths:

- `markdown`
- `need_image`
- `image_prompt`
- `image_alt`
- `metadata`
- `metadata.probability`

Schema-only rules:

- `markdown` must be a string containing markdown text.
- Media fields must validate through `CommentOutputSchema`.
- Metadata shape is schema-stage responsibility, not audit responsibility.

### `reply`

Allowed repair paths:

- `markdown`
- `need_image`
- `image_prompt`
- `image_alt`
- `metadata`
- `metadata.probability`

Schema-only rules:

- `markdown` must be a string containing markdown text.
- Media fields must validate through `ReplyOutputSchema`.
- Metadata shape is schema-stage responsibility, not audit responsibility.

## Repair Decision Table

| Condition                                                                                                                           | Action                                                                                            | Audit?                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| JSON extracts, parses, and validates                                                                                                | pass typed object forward                                                                         | yes                          |
| `finishReason=length` and raw text non-empty                                                                                        | run schema-grounded finish repair, then parse/validate again                                      | only after validation passes |
| AI SDK object generation error says provider failed to generate a parsable object conforming to schema, and raw/partial text exists | normalize as length-equivalent; run schema-grounded finish repair                                 | only after validation passes |
| deterministic tail closure validates                                                                                                | accept closed output                                                                              | yes                          |
| finish repair returns valid continuation                                                                                            | concatenate, validate, accept                                                                     | yes                          |
| finish repair returns parseable JSON with missing/invalid fields                                                                    | run field-patch repair, then parse/validate again                                                 | only after validation passes |
| parsed object has missing/invalid schema fields                                                                                     | field-patch repair                                                                                | only after validation passes |
| non-length invalid JSON has repairable partial object                                                                               | field-patch repair                                                                                | only after validation passes |
| empty output with `finishReason=length`                                                                                             | typed transport/token diagnostic                                                                  | no                           |
| AI SDK object generation error has no usable text prefix                                                                            | treat like empty `finishReason=length`; typed transport/token diagnostic or allowed compact retry | no                           |
| repair changes immutable completed fields                                                                                           | reject repair                                                                                     | no                           |
| repair still invalid after bounded attempts                                                                                         | typed schema failure                                                                              | no                           |

## Bounded Repair Loop

The schema gate should be implemented as a small state machine, not as one linear branch.

```text
attempt = initial_parse
while attempts remain:
  extract + parse + validate current candidate
  if valid:
    return typed object

  if parse failed because finishReason=length or normalized object-generation failure and continuation not yet attempted:
    current candidate = finish_continuation(previous_output)
    continue

  if deterministic closure can create a parseable candidate:
    current candidate = closed_candidate
    continue

  if current candidate is parseable enough and schema errors map to allowed paths:
    current candidate = field_patch_repair(current_candidate, schema_errors)
    continue

  return typed schema failure
```

Loop rules:

- `finish_continuation` does not need to produce a fully schema-valid object in one step.
- If `finish_continuation` produces valid JSON that is missing required fields or has invalid field values, run `field_patch_repair`.
- Missing fields are a primary field-patch use case, not an edge case.
- If `field_patch_repair` still leaves schema errors, the loop may run another bounded field-patch attempt if the errors map to allowed paths.
- Bound repair attempts per stage, for example:
  - deterministic closure: at most 1 successful candidate family
  - finish continuation: 1 attempt, with optional suffix or fragment merge when unambiguous
  - field patch: 1 or 2 attempts
- After every repair output, rerun extraction, parse, and full schema validation before deciding the next step.
- Never send a repair output to audit just because it parses; it must validate against the flow schema.

## Prompt Contracts

Do not create per-flow schema-repair templates in the prompt-family builder.

Use one shared finish-continuation prompt from the current LLM JSON stage contract:

```text
[finish_continuation]
The previous response hit finishReason=length and stopped before the JSON was complete.
Do not regenerate the full object.
Return only the missing JSON suffix or minimal object fragment requested by the schema gate.
The full schema is enforced in code with AI SDK Output.object and Zod.
Do not add commentary, markdown, or a full rewritten object.
```

Use one shared field-patch output schema in code, such as an operation-list `FieldPatchRepairSchema`.
The field-patch prompt names the allowlisted paths and asks for repair values, but does not embed a hardcoded key/type JSON example.

Rules:

- Field patch paths must be in `allowedRepairPaths`.
- Unknown paths fail.
- Extra generated-output keys are stripped or ignored, but unknown patch paths still fail.
- Patch values are merged into the parsed partial object by path.
- The merged object must validate before audit.
- The repair prompt must not ask for a quality rewrite.
- The repair prompt must not include persona packet unless a specific schema field needs persona evidence; prefer schema-only repair.
- Finish repair output must re-enter parse and schema validation. If it becomes parseable but schema-invalid, field-patch repair handles the remaining missing or invalid fields.

## Audit Boundary

Audits receive only validated generated output plus quality context.

Audit must not check:

- JSON parseability
- required keys
- field types
- candidate count
- `metadata.probability` presence or range
- media field schema shape

Audit may check:

- persona fit
- procedure fit
- board or policy fit
- selected-plan fit
- novelty or non-repetition
- direct reply fit
- thread continuity
- markdown quality as publishable content quality, not as a string/type check
- story/narrative fit when `contentMode === "story"`

## Debug Metadata

Every shared schema gate run should emit compact debug metadata:

```ts
type SharedJsonSchemaGateDebug = {
  flowId: string;
  stageId: string;
  schemaName: string;
  status: "passed" | "repaired" | "failed";
  attempts: Array<{
    attemptStage:
      | "initial_parse"
      | "deterministic_tail_closure"
      | "finish_continuation"
      | "field_patch";
    finishReason: string | null;
    likelyOpenPath: string | null;
    requiredRemainingPaths: string[];
    errorSummary: string | null;
  }>;
};
```

Do not put full prompt text or full raw model output in normal debug metadata unless the existing debug surface already stores it behind the preview/debug boundary.

## Implementation Plan For DeepSeek

### Task 1: Add Shared Schema Gate Wrapper

**Files:**

- Create or modify: `src/lib/ai/json-repair/response-finisher.ts`
- Create: `src/lib/ai/json-repair/schema-gate.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`
- Optional create: `src/lib/ai/prompt-runtime/persona-v2-schema-gate.ts` as a thin Persona v2 adapter only.
- Optional test: `src/lib/ai/prompt-runtime/persona-v2-schema-gate.test.ts`

**Work:**

- Implement `runSharedJsonSchemaGate(input)`.
- Reuse shared finish and field-patch repair utilities.
- Accept flow-specific Zod schema, validation rules, allowed repair paths, and immutable paths.
- Return either `{ status: "valid", value, debug }` or typed schema failure.
- Keep Persona-specific flow names, persona packets, and audit concepts out of the shared module.
- Implement repair as a bounded loop/state machine, not as independent one-shot `finish` and `patch` branches.
- Ensure finish-repair output can flow into field-patch repair if it parses but still fails schema validation.

**Verification:**

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/prompt-runtime/persona-v2-schema-gate.test.ts
```

### Task 2: Add Shared Schema Inputs And Persona v2 Adapters

**Files:**

- Create or modify: `src/lib/ai/json-repair/schema-gate-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Test: `src/lib/ai/json-repair/schema-gate-contracts.test.ts`
- Test: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`

**Work:**

- Define the generic schema gate input contract once.
- Define reusable typed failure results once.
- Export Zod schemas for all four flows.
- Export validation rules for all four flows.
- Export schema-derived repair path metadata for all four flows.
- Export allowed repair paths for all four flows.
- Keep prompt output-policy labels and code-owned Zod schemas aligned.
- Make Persona v2 contracts inputs to the shared gate, not special logic inside it.

**Verification:**

```bash
npx vitest run src/lib/ai/json-repair/schema-gate-contracts.test.ts src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

### Task 3: Route Main Outputs Through Schema Gate Before Audit

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify: flow tests near these modules.

**Work:**

- Run schema gate immediately after `main`.
- Only call audit with the validated typed object.
- Do not call audit after schema-gate failure.
- Preserve raw response/debug fields according to existing preview conventions.

**Verification:**

```bash
npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/single-stage-writer-flow.test.ts
```

### Task 4: Route Quality Repair Outputs Through Schema Gate Before Re-Audit

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Test: matching flow tests.

**Work:**

- After quality repair returns raw JSON, run the same schema gate.
- Only re-audit if repaired output validates.
- If quality repair output fails schema gate, return schema failure rather than asking audit to diagnose it.

**Verification:**

```bash
npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/single-stage-writer-flow.test.ts
```

### Task 5: Make Audit Tests Prove Schema Is Out Of Scope

**Files:**

- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Test: matching audit tests.

**Work:**

- Remove schema-check language from audit prompt constants.
- Keep quality checks only.
- Add tests that audit prompt text does not include schema-validation duties.
- Keep audit output schema shape explicit for the audit response itself.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/post-plan-audit.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts
```

### Task 6: Migrate Other JSON-Producing Flows To Shared Gate

**Files:**

- Modify selected JSON-output services after Persona v2 integration proves the shared gate:
  - `src/lib/ai/admin/persona-generation-contract.ts`
  - `src/lib/ai/admin/persona-generation-preview-service.ts`
  - `src/lib/ai/prompt-runtime/post-plan-audit.ts`
  - `src/lib/ai/prompt-runtime/post-body-audit.ts`
  - `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
  - `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
  - `src/lib/ai/agent/intake/intake-stage-llm-service.ts`

**Work:**

- Inventory every LLM call that expects JSON.
- Add a schema contract, validation rules, allowed repair paths, and immutable paths for each JSON output.
- Route raw JSON model output through `runSharedJsonSchemaGate()` before app-owned logic consumes it.
- Keep flow-specific semantic or quality audits separate from schema repair.

Persona generation requirement:

- Route one-stage Persona Core v2 generation output through `runSharedJsonSchemaGate()`.
- Include all required Persona Core v2 field paths in the allowed repair path map where safe.
- Add tests where the model returns valid JSON missing nested persona fields and field-patch repair fills them.
- Do not keep a separate persona-generation-only repair implementation after the shared gate exists.

**Verification:**

```bash
rg -n "JSON.parse|safeJson|parse.*Json|finishReason" src/lib/ai
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts
```

## Required Test Cases

- Valid main output goes directly to audit.
- Invalid JSON with `finishReason=length` runs finish continuation before field patch.
- AI SDK structured-output object generation failure with message text like "fails to generate a parsable object that conforms to the schema" and usable raw text runs the same finish continuation path as `finishReason=length`.
- AI SDK structured-output object generation failure without usable raw text returns the same typed diagnostic path as empty `finishReason=length`, unless the flow explicitly allows a smaller compact retry.
- Finish continuation that returns parseable JSON with missing fields flows into field-patch repair, then audit only after validation passes.
- Field patch may loop for one additional bounded attempt when the previous patch leaves allowed schema errors.
- Invalid JSON without length finish skips continuation and uses field patch when possible.
- Missing writer field is repaired by field patch, then audited.
- Missing nested Persona Core v2 generation field is repaired by the shared field-patch loop before preview/save.
- Persona generation uses the same shared schema gate as prompt-family JSON outputs.
- Unknown patch path is rejected.
- Patch that changes immutable completed fields is rejected.
- Empty `finishReason=length` output returns typed diagnostic and does not audit.
- Audit is not called when schema gate fails.
- Quality repair output is schema-gated before re-audit.
- Audit prompt constants do not mention schema validation as an audit responsibility.
- A non-Persona JSON output can use the same shared schema gate with a different `flowId`, `stageId`, schema, and repair-path allowlist.

## Staff-Engineer Review Checklist

- [ ] Shared schema gate exists outside Persona-specific prompt-family code.
- [ ] Every app-owned structured JSON output has a path to `invokeStructuredLLM` / the shared schema gate before app-owned consumption.
- [ ] Every new JSON stage uses AI SDK structured output with `Output.object({ schema })` where provider support allows it.
- [ ] Prompt text does not include hardcoded full key/type JSON schema blocks.
- [ ] Persona v2 uses the shared gate through a thin adapter, not a forked repair framework.
- [ ] Persona generation output uses the same shared schema gate before preview/save.
- [ ] Schema gate runs before every audit.
- [ ] Audit never receives unparseable or schema-invalid generated output.
- [ ] `finishReason=length` uses continuation repair before field patch.
- [ ] AI SDK structured-output object generation failures that cannot produce a parsable schema-conforming object are treated as `finishReason=length`-equivalent for repair routing.
- [ ] Finish repair can fall through to field patch when the continued JSON parses but remains schema-invalid.
- [ ] Repair attempts are loopable but bounded.
- [ ] Non-length schema failures use field patch where possible.
- [ ] Field patches are path allowlisted.
- [ ] Missing fields are repairable when their paths are allowlisted.
- [ ] Completed prefix fields are protected.
- [ ] Flow output schemas and schema-gate schemas stay aligned.
- [ ] Audit remains quality-only.
- [ ] Debug metadata explains every repair attempt without leaking unnecessary full prompts.

## Handoff Summary

DeepSeek should implement schema repair as one shared structured JSON-output boundary, not as a Persona-only utility and not as another prompt family template. The correct shape is: app-owned JSON stages call `invokeStructuredLLM`, raw invocation still passes `Output.object({ schema })`, the shared gate repairs schema until the object is valid, then downstream app logic or quality audit may run. If schema repair cannot produce a valid object, the flow fails before audit or persistence.
