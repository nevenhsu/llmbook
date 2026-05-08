# DeepSeek Schema Gate Implementation Review and Hardening Plan

## Goal

Turn the current DeepSeek implementation into a reliable shared structured-JSON boundary for Persona v2 and related LLM JSON stages.

The desired final shape:

- Raw provider calls can pass AI SDK `Output.object({ schema })`.
- Structured JSON stages call `invokeStructuredLLM`.
- `invokeStructuredLLM` always routes output through schema gate validation and bounded repair.
- `finishReason=length` and AI SDK object-generation parse failures are treated as length-like failures.
- Truncated but usable JSON prefix is finished or field-patched, not rewritten from scratch.
- Zod schemas own shape filtering and array truncation policy.
- Semantic audits do not audit schema shape or `metadata.probability`.

## Current Verification Snapshot

Focused tests pass:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/json-repair/response-finisher.test.ts src/lib/ai/llm/invoke-llm.test.ts src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

Result:

```text
Test Files  4 passed (4)
Tests       102 passed (102)
```

TypeScript does not pass:

```bash
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
```

Important schema-gate-related failures:

- Duplicate type exports in `src/lib/ai/json-repair/schema-gate-contracts.ts`.
- `InvokeStructuredLlmOutput` is imported but not exported from `src/lib/ai/llm/types.ts`.
- Provider `output` typing was widened to `unknown`, so AI SDK `generateText` sees `{}` instead of `Output<any, any, any>`.
- Zod v4 internal introspection in `schema-gate.ts` and `field-patch-schema.ts` is not type-safe.
- Current tests still encode older behavior where overlong arrays are invalid instead of normalized by schema-owned transforms.

## Current Implementation Assessment

DeepSeek added useful building blocks:

- `src/lib/ai/llm/invoke-structured-llm.ts`
- `src/lib/ai/json-repair/schema-gate.ts`
- `src/lib/ai/json-repair/schema-gate-contracts.ts`
- `src/lib/ai/json-repair/schema-gate-adapters.ts`
- `src/lib/ai/json-repair/field-patch-schema.ts`
- `src/lib/ai/json-repair/response-finisher.ts`
- schema metadata and Zod output schemas in `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`

But the implementation is not yet reliable because the runtime path is only partially connected:

- `invokeStructuredLLM` calls raw `invokeLLMRaw`, but does not force `modelInput.output = Output.object({ schema })` on the first call.
- Persona interaction and persona generation preview still mostly use raw `invokeLLM`, so the shared schema gate is not the actual runtime boundary.
- Finish continuation is incorrectly schema-bound to `FieldPatchRepairSchema`.
- FieldPatch is only a generic operation list and does not validate repaired values against leaf schemas.
- Deterministic tail closure still contains semantic value invention.
- Old rewrite-from-scratch truncation retry still exists in the persona generation preview flow.

## Required Architecture

### Raw Invocation

`invokeLLMRaw` is the provider transport boundary only:

- Accepts prompt/messages/options.
- Accepts optional `modelInput.output`.
- Forwards `Output.object({ schema })` to AI SDK providers when supplied.
- Does not parse, schema-repair, audit, or retry schema shape.
- Returns text, optional object, finishReason, usage, provider metadata, and provider error details.

Keep `invokeLLM` as an alias only during migration if needed, but new structured JSON call sites should not use it directly.

### Structured Invocation

`invokeStructuredLLM<T>` owns the app schema boundary:

1. Clone `modelInput`.
2. Force `modelInput.output = Output.object({ schema })` unless an explicitly compatible structured output is already provided.
3. Call `invokeLLMRaw`.
4. Send `{ raw.text, raw.object, raw.finishReason, raw.errorDetails }` to `runSharedJsonSchemaGate`.
5. Let schema gate validate, finish, or field-patch.
6. Return either `{ status: "valid", value, raw, schemaGateDebug }` or `{ status: "schema_failure", error, raw, schemaGateDebug }`.

Repair callbacks must call `invokeLLMRaw`, never `invokeStructuredLLM`, to avoid recursive repair.

### Schema Ownership

Zod schemas should enforce runtime shape:

- Extra keys are allowed at validation input and stripped by Zod output.
- Overlong arrays are truncated by schema-owned preprocess/transform where that is the product rule.
- Missing required fields remain invalid and go to FieldPatch.
- `metadata.probability` is normalized/defaulted but not audited semantically.

Do not reintroduce `assertExactKeys` for generated LLM outputs.

## Flow Output Coverage Audit

Current inspection shows that JSON-output coverage is incomplete.

Every LLM stage whose output is parsed as JSON must have a code-owned output schema. That includes main, schema repair, semantic/quality audit, audit-after-repair, and quality repair.

### Persona Interaction Flows

Entry point:

- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`

Current state:

- `main` stages pass `Output.object({ schema })` through `resolveOutputSchema`.
- `quality_repair` stages pass `Output.object({ schema })` through `resolveOutputSchema`.
- `schema_repair` stages do not pass `Output.object({ schema })`.
- `audit` stages do not pass `Output.object({ schema })`.
- Audit schemas already exist in `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`, but they are not wired into invocation.

Required coverage matrix:

| Flow                 | Stage                    | Required schema                                                                       |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `post_plan`          | `main`                   | `PostPlanOutputSchema`                                                                |
| `post_plan`          | `schema_repair`          | `PostPlanOutputSchema` or shared schema gate FieldPatch, not standalone prompt repair |
| `post_plan`          | `quality_repair`         | `PostPlanOutputSchema`                                                                |
| `post_plan`          | `audit` / `audit_repair` | `PostPlanDiscussionAuditSchema` or `PostPlanStoryAuditSchema` by `contentMode`        |
| `post_body` / `post` | `main`                   | `PostBodyOutputSchema`                                                                |
| `post_body` / `post` | `schema_repair`          | `PostBodyOutputSchema` or shared schema gate FieldPatch, not standalone prompt repair |
| `post_body` / `post` | `quality_repair`         | `PostBodyOutputSchema`                                                                |
| `post_body` / `post` | `audit` / `audit_repair` | `PostBodyDiscussionAuditSchema` or `PostBodyStoryAuditSchema` by `contentMode`        |
| `comment`            | `main`                   | `CommentOutputSchema`                                                                 |
| `comment`            | `schema_repair`          | `CommentOutputSchema` or shared schema gate FieldPatch, not standalone prompt repair  |
| `comment`            | `quality_repair`         | `CommentOutputSchema`                                                                 |
| `comment`            | `audit` / `audit_repair` | `CommentDiscussionAuditSchema` or `CommentStoryAuditSchema` by `contentMode`          |
| `reply`              | `main`                   | `ReplyOutputSchema`                                                                   |
| `reply`              | `schema_repair`          | `ReplyOutputSchema` or shared schema gate FieldPatch, not standalone prompt repair    |
| `reply`              | `quality_repair`         | `ReplyOutputSchema`                                                                   |
| `reply`              | `audit` / `audit_repair` | `ReplyDiscussionAuditSchema` or `ReplyStoryAuditSchema` by `contentMode`              |

### Persona Generation Preview

Entry point:

- `src/lib/ai/admin/persona-generation-preview-service.ts`

Current state:

- `persona_core_v2` first attempt passes `Output.object({ schema: PersonaCoreV2Schema })`.
- `persona_core_v2` parse path trusts `result.object` directly before schema gate.
- Semantic audit calls do not pass a structured audit output schema.
- Quality repair calls do not pass a structured repair output schema.
- Truncation retry still rewrites from scratch.

Required coverage:

- `persona_core_v2.main`: `PersonaCoreV2Schema` through `invokeStructuredLLM`.
- `persona_core_v2.semantic_audit`: a dedicated `PersonaGenerationSemanticAuditSchema`.
- `persona_core_v2.quality_repair`: either a dedicated delta schema such as `{ repair: record }` or full `PersonaCoreV2Schema`, chosen explicitly. Do not leave it as raw untyped JSON.
- `persona_core_v2.schema_repair`: no standalone rewrite prompt; use shared schema gate finish continuation and FieldPatch.

### Intake JSON Stages

Entry point:

- `src/lib/ai/agent/intake/intake-stage-llm-service.ts`

Current state:

- `main` passes `Output.object` for `OpportunityProbabilityOutputSchema` or `SpeakerCandidatesOutputSchema`.
- `quality_repair` passes the same output schemas.
- `schema_repair` does not pass `Output.object`.
- `quality_audit` does not pass `Output.object` even though `JsonAuditResultSchema` exists.
- Length retry for `main` does not pass `Output.object`.

Required coverage:

- `main`: current stage schema.
- `main:length-retry`: same stage schema.
- `schema_repair`: same stage schema or shared schema gate FieldPatch.
- `quality_repair`: same stage schema.
- `quality_audit`: `JsonAuditResultSchema`.

## Phase 0: Restore Compile Baseline

### Tasks

1. Delete duplicate type definitions from `src/lib/ai/json-repair/schema-gate-contracts.ts`.
2. Export `InvokeStructuredLlmOutput<T>` from `src/lib/ai/llm/types.ts`, or move it into `invoke-structured-llm.ts` and stop importing it from `types.ts`.
3. Replace `LlmGenerateTextInput.output?: unknown` with a concrete AI SDK output type, for example:

```ts
import type { Output } from "ai";

export type LlmStructuredOutput = Output<any, any, any>;

export type LlmGenerateTextInput = {
  // ...
  output?: LlmStructuredOutput;
};
```

4. Fix provider call types in:
   - `src/lib/ai/llm/providers/deepseek-provider.ts`
   - `src/lib/ai/llm/providers/minimax-provider.ts`
   - `src/lib/ai/llm/providers/xai-provider.ts`
5. Remove unsafe Zod `_def.typeName` access or isolate it behind a small tested helper compatible with current Zod.
6. Re-run:

```bash
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
```

### Delete or Correct

- Delete duplicate block in `src/lib/ai/json-repair/schema-gate-contracts.ts` around the second `SchemaGateDebugAttempt`, `SchemaGateDebug`, `SchemaGateSuccess`, `SchemaGateFailure`, `SchemaGateResult`, and `BracketState` definitions.
- Delete unused imports in `src/lib/ai/json-repair/schema-gate.ts`: `TruncationClassification`, `SchemaGateAttemptStage`, and `deriveRequiredRemainingPaths` unless they are actively used after refactor.
- Delete the unused import and dead adapter references in `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`: `PatchLlmInvoker` and `createFieldPatchAdapter`.

## Phase 1: Fix `invokeStructuredLLM`

### Tasks

1. Make `invokeStructuredLLM` force structured output on the first call:

```ts
const structuredModelInput = {
  ...input.modelInput,
  output: Output.object({ schema: input.schemaGate.schema }),
};
```

2. Preserve caller options such as prompt, max tokens, temperature, provider options, tools, and metadata.
3. Pass `structuredModelInput` to `invokeLLMRaw`.
4. Add focused tests in a new `src/lib/ai/llm/invoke-structured-llm.test.ts`:
   - first attempt receives `Output.object({ schema })`
   - valid `raw.object` returns `status: "valid"`
   - invalid schema calls FieldPatch callback
   - `finishReason=length` calls finish continuation
   - pure string use cases still use raw `invokeLLM` and do not enter schema gate

### Delete or Correct

- Correct `src/lib/ai/llm/invoke-structured-llm.ts` lines where `Output` is imported but not used.
- Do not rely on call sites to manually pass `Output.object`; the wrapper must own this.

## Phase 2: Fix Schema Gate Flow

### Tasks

1. Define schema-gate flow as:
   - validate `raw.object` first if present
   - if invalid and raw text exists, extract JSON text
   - validate parseable JSON
   - for length-like failures, attempt syntax-only tail closure
   - if parseable but schema-invalid, FieldPatch
   - if not parseable but prefix is usable, finish continuation
   - validate final merged result
2. Treat AI SDK object-generation errors like "fails to generate a parsable object that conforms to the schema" as length-like only when raw text exists.
3. For empty text with length-like error, return a transport/token diagnostic failure; do not ask the model to invent a whole object.
4. Replace schema required-path extraction with one of:
   - explicit schema metadata passed from each output schema, preferred for Persona v2
   - a small Zod helper tested against current Zod v4 objects, arrays, optional/default/effects
5. Make debug attempts report:
   - normalized failure reason
   - stage attempted
   - likely open path
   - repairable paths
   - final parse/schema error summary

### Delete or Correct

- Delete no-op `stripExtraKeys` and `normalizeOverlongArrays` in `src/lib/ai/json-repair/schema-gate.ts`; shape filtering and truncation must be schema-owned.
- Delete inline wildcard path matching in `schema-gate.ts` and use `matchesAllowedPath` from `field-patch-schema.ts`.
- Do not call FieldPatch with every failing path. Only pass paths that are allowed, non-immutable, and actually failed or are missing required paths.

## Phase 3: Fix Deterministic Tail Closure

### Tasks

1. Tail closure may only append syntax:
   - `"`
   - `]`
   - `}`
   - combinations of those closers
2. It must not append placeholder values, empty semantic strings, fake arrays, fake objects, commas with fake members, or guessed field values.
3. If the prefix ends after a colon, dangling comma, incomplete key, or incomplete value, classify it as `continuation_needed`.
4. Add tests for:
   - object closed by `}`
   - nested array/object closed by `]}`
   - dangling comma goes to continuation
   - incomplete string value goes to continuation unless closing only the quote plus structural closers yields valid JSON
   - no output contains `"placeholder"` or invented `""` values

### Delete or Correct

- Delete semantic suffix candidate in `src/lib/ai/json-repair/response-finisher.ts`:

```ts
results.push('"",\n  ' + suffixes.join(""));
```

- Delete `reverseStack` handling that maps string markers to `}`. If strings are open or broken, route to continuation unless a syntax-only quote close makes the entire JSON parseable.

## Phase 4: Split Finish Continuation from FieldPatch

### Tasks

1. Define a separate finish continuation result contract, for example:

```ts
const FinishContinuationSchema = z.object({
  suffix: z.string().default(""),
  completed_fragment: z.unknown().optional(),
});
```

2. Prefer `suffix` when the model can continue the exact JSON tail.
3. Use `completed_fragment` only for explicitly supported open paths where a safe merge is deterministic.
4. Validate the completed output after suffix/fragment merge.
5. If finish continuation yields parseable but schema-invalid JSON, route to FieldPatch.

### Delete or Correct

- Delete `FieldPatchRepairSchema` usage from `createFinishContinuationAdapter`.
- Do not append `result.text` blindly when the repair call used a structured output schema.
- Do not serialize a field-patch operation object and append it to partial JSON.

## Phase 5: Make FieldPatch Real and Bounded

### Tasks

1. Keep FieldPatch as operation-list output:

```json
{
  "repair": [{ "path": "reference_style.reference_names", "value": ["..."] }]
}
```

2. Return and consume operations directly. Do not convert operations into dotted-object patches and then flatten them again.
3. Validate every operation:
   - path matches allowed repair patterns
   - path is not immutable
   - path is not a prototype-pollution segment
   - path is in the current failing/missing path set
   - value conforms to the path leaf schema when leaf schema is known
4. Implement safe array path handling for paths such as `candidates.0.title`.
5. Reject wildcard writes. Wildcards may exist in allowed patterns, not in actual repair output paths.
6. Add tests for:
   - missing required field repair
   - invalid primitive repair
   - array item repair
   - overlong arrays are schema-normalized when schema says so
   - immutable path rejection
   - `__proto__`, `prototype`, and `constructor` segment rejection

### Delete or Correct

- Delete the unused `inferLeafSchema` if leaf validation is not implemented immediately. Preferred: implement and test it.
- Correct `buildFieldPatchSchema`; it currently ignores `rootSchema` and `repairablePaths`.
- Delete the operation-to-dotted-object conversion in `createFieldPatchAdapter`.
- Correct `applyFieldPatch` so path pollution checks inspect every segment, not only full string equality.

## Phase 6: Wire Persona Interaction Runtime to Structured Invocation

### Tasks

1. In `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`, use `invokeStructuredLLM` for every generated JSON stage:
   - `post_plan.main`
   - `post_plan.schema_repair` while legacy path still exists; preferred final state is shared schema gate FieldPatch instead of this prompt stage
   - `post_plan.audit`
   - `post_plan.audit_repair`
   - `post_plan.quality_repair`
   - `post_body.main`
   - `post_body.schema_repair` while legacy path still exists; preferred final state is shared schema gate FieldPatch instead of this prompt stage
   - `post_body.audit`
   - `post_body.audit_repair`
   - `post_body.quality_repair`
   - `post.main`
   - `comment.main`
   - `comment.schema_repair` while legacy path still exists; preferred final state is shared schema gate FieldPatch instead of this prompt stage
   - `comment.audit`
   - `comment.audit_repair`
   - `comment.quality_repair`
   - `reply.main`
   - `reply.schema_repair` while legacy path still exists; preferred final state is shared schema gate FieldPatch instead of this prompt stage
   - `reply.audit`
   - `reply.audit_repair`
   - `reply.quality_repair`
2. Replace `resolveOutputSchema` with a stage-aware resolver:
   - writer stages (`main`, `schema_repair`, `quality_repair`) resolve to the flow output schema
   - audit stages resolve to the flow audit schema based on `contentMode`
   - non-JSON stages resolve to `undefined` and must not be parsed as JSON downstream
3. Use `resolveFlowSchemaMeta` or a new stage-aware metadata resolver to pass:
   - schema name
   - validation rules
   - allowed repair paths
   - immutable paths
4. Add audit schema metadata for:
   - `PostPlanDiscussionAuditSchema`
   - `PostPlanStoryAuditSchema`
   - `PostBodyDiscussionAuditSchema`
   - `PostBodyStoryAuditSchema`
   - `CommentDiscussionAuditSchema`
   - `CommentStoryAuditSchema`
   - `ReplyDiscussionAuditSchema`
   - `ReplyStoryAuditSchema`
5. Make audit stages schema-bound but not semantically schema-audited. Schema gate validates shape; the audit result itself decides quality.
6. Make debug records include schema-gate attempts for main, audit, and repair.
7. Replace old standalone `schema_repair` path for these flows with shared schema gate repair.
8. Keep compatibility only where a non-JSON flow is explicitly not consumed by runtime JSON parsers.

### Delete or Correct

- Delete unused `resolveOutputSchema` once structured invocation owns `Output.object`.
- Delete or retire `PersonaInteractionStagePurpose = "schema_repair"` for Persona v2 runtime if no call path should invoke standalone schema repair.
- Delete old `post_plan.schema_repair`, `post_body.schema_repair`, `comment.schema_repair`, and `reply.schema_repair` runtime calls after shared schema gate is wired.
- Delete raw audit parsing as the primary shape guard. Parsers may remain as normalization adapters, but invocation must supply audit `Output.object({ schema })`.

## Phase 7: Wire Persona Generation Preview to Structured Invocation

### Tasks

1. For `persona_core_v2`, call `invokeStructuredLLM` with:
   - `schema: PersonaCoreV2Schema`
   - schema name `PersonaCoreV2`
   - Persona v2 allowed repair paths
   - immutable paths for identity fields that should not be mutated by repair, if needed
2. Return `structured.value` from successful schema gate.
3. Preserve raw text and schema gate debug attempts in preview debug output.
4. Add `PersonaGenerationSemanticAuditSchema` and call semantic audits with structured output:
   - `passes: boolean`
   - `issues: string[]`
   - `repairGuidance: string[]`
   - optional `keptReferenceNames: string[]`
5. Add an explicit quality repair output schema. Choose one of these and document the choice in code:
   - full-object repair: `PersonaCoreV2Schema`
   - delta repair: `z.object({ repair: z.record(z.string(), z.unknown()) })`
6. If delta repair remains the chosen quality-repair shape, validate the merged object with `PersonaCoreV2Schema` after applying the delta.
7. Keep quality audit and quality repair after schema gate only.
8. If schema gate fails, surface `schemaGateDebug` to the admin preview response.

### Delete or Correct

- Delete direct trust of `result.object` in `attemptParse` for `persona_core_v2`; it must still pass `PersonaCoreV2Schema.safeParse` or shared schema gate.
- Delete untyped semantic audit invocation; audit JSON must use `Output.object({ schema: PersonaGenerationSemanticAuditSchema })` or `invokeStructuredLLM`.
- Delete untyped quality repair invocation; repair JSON must use its explicit repair schema.
- Delete rewrite-from-scratch truncation retry for usable partial JSON:

```text
Rewrite it from scratch in a shorter form.
Rewrite a complete valid JSON object from scratch...
```

- Delete stage-specific legacy truncation hints for `seed` and old `persona_core` once one-stage `persona_core_v2` is the only active generation path.
- Delete retry logic that invokes raw attempt 2 for parse failure when schema gate can finish or field-patch the first output.

## Phase 8: Remove Old Exact-Key and Schema-Audit Logic

### Tasks

1. Generated model outputs should be checked by Zod schemas and schema gate only.
2. Remove exact-key validation from generated-output parsers where Zod is now the source of truth.
3. Keep exact-key checks only for app-authored internal config objects if needed.
4. Ensure semantic audits do not inspect:
   - required keys
   - extra keys
   - array counts
   - parseability
   - field types
   - `metadata.probability`

### Delete or Correct

- Delete `assertExactKeys` usage for generated Persona v2 outputs in `src/lib/ai/admin/persona-generation-contract.ts`.
- Delete `assertExactKeys` usage for generated post-plan audit output in `src/lib/ai/prompt-runtime/post-plan-audit.ts` if that output becomes schema-bound.
- Delete tests that expect overlong arrays to fail when the schema now truncates them by product rule.

## Phase 8.5: Close Intake JSON Stage Output Gaps

### Tasks

1. In `src/lib/ai/agent/intake/intake-stage-llm-service.ts`, pass `Output.object({ schema })` for `main:length-retry`.
2. Pass `Output.object({ schema })` for `schema_repair`, using the same stage output schema as `main`.
3. Pass `Output.object({ schema: JsonAuditResultSchema })` for `quality_audit`.
4. Prefer moving intake JSON stages to `invokeStructuredLLM` once the shared wrapper is stable.
5. Keep parser fallback only for legacy tests or provider paths where `object` is unavailable, but still validate through the same Zod schema before consuming.

### Delete or Correct

- Delete untyped length retry invocation in `runJsonStage`.
- Delete untyped schema repair invocation in `runJsonStage`.
- Delete untyped quality audit invocation in `runQualityAudit`.
- Delete exact-key audit parsing as the only shape guard after `JsonAuditResultSchema` is wired.

## Phase 9: Update Tests to Match Product Truth

### Add or Update Tests

1. `invoke-structured-llm.test.ts`
   - structured output forced
   - raw repair callbacks do not recurse
   - valid object path
   - schema failure path
   - length-like finish continuation path

2. `schema-gate.test.ts`
   - extra keys are stripped by schema parse
   - overlong arrays are truncated only when schema transform says so
   - missing required fields use FieldPatch
   - invalid values use FieldPatch
   - object-generation parse error is length-like when raw text exists

3. `response-finisher.test.ts`
   - no placeholder or invented semantic suffix
   - dangling comma uses continuation
   - syntax-only closure succeeds only when JSON.parse succeeds

4. `field-patch-schema.test.ts`
   - allowed path matching
   - array index writes
   - pollution rejection
   - immutable rejection
   - value validation

5. Persona generation preview tests
   - `persona_core_v2.main` uses `PersonaCoreV2Schema`
   - semantic audit uses `PersonaGenerationSemanticAuditSchema`
   - quality repair uses the chosen full-object or delta repair schema
   - truncated partial JSON does not trigger rewrite-from-scratch prompt
   - schema-gate debug is visible on failure
   - no raw `result.object` is trusted without schema gate validation

6. Persona interaction runtime tests
   - `main` writer stages call `invokeStructuredLLM`
   - `schema_repair` no longer runs as standalone prompt repair for Persona v2 flows
   - `quality_repair` writer stages call `invokeStructuredLLM` with the same writer output schema as `main`
   - `audit` and `audit_repair` stages call `invokeStructuredLLM` with the correct audit schema for flow and `contentMode`

7. Intake stage tests
   - `main` and `main:length-retry` pass the stage output schema
   - `schema_repair` passes the stage output schema
   - `quality_repair` passes the stage output schema
   - `quality_audit` passes `JsonAuditResultSchema`

### Verification Commands

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/json-repair/response-finisher.test.ts src/lib/ai/json-repair/field-patch-schema.test.ts src/lib/ai/llm/invoke-structured-llm.test.ts
npx vitest run src/lib/ai/admin/persona-generation-preview-service.test.ts src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts
npx vitest run src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts
npx tsc --noEmit --pretty false --ignoreDeprecations 6.0
npm run verify
```

## Implementation Order for DeepSeek

1. Restore compile baseline first. Do not continue feature wiring while TypeScript is red.
2. Fix `invokeStructuredLLM` to force `Output.object({ schema })` and add tests.
3. Fix response finisher so deterministic closure is syntax-only.
4. Split finish continuation from FieldPatch.
5. Make FieldPatch operation-list handling real, bounded, and tested.
6. Wire persona generation preview to `invokeStructuredLLM`.
7. Wire persona interaction runtime to `invokeStructuredLLM`.
8. Wire every audit and audit-after-repair stage to an explicit `Output.object({ schema })`.
9. Close intake JSON output gaps for length retry, schema repair, and quality audit.
10. Remove old rewrite-from-scratch and standalone schema repair paths.
11. Remove exact-key generated-output checks and old tests that assert strict extra-key failure.
12. Run the full verification commands.

## Acceptance Criteria

- `invokeStructuredLLM` is the only entry point for app-owned structured JSON generation.
- Raw `invokeLLMRaw` still supports `Output.object({ schema })`, but does not repair.
- Persona Core v2 generation uses `PersonaCoreV2Schema` through structured output and schema gate.
- Persona interaction `main`, `audit`, `audit_repair`, and `quality_repair` stages all use explicit code-owned output schemas.
- Standalone Persona v2 `schema_repair` prompts are removed or replaced by shared schema gate repair.
- Persona generation semantic audit and quality repair use explicit output schemas.
- Intake `main`, `main:length-retry`, `schema_repair`, `quality_repair`, and `quality_audit` use explicit output schemas.
- `finishReason=length` with usable partial JSON does not rewrite from scratch.
- Tail closure never invents semantic values.
- Finish continuation no longer uses `FieldPatchRepairSchema`.
- FieldPatch can repair only missing or invalid allowed paths.
- Extra generated keys do not fail validation when Zod strips them.
- Overlong arrays are truncated only by schema-owned rules.
- `metadata.probability` is not audited.
- TypeScript passes.
- Focused schema-gate, field-patch, response-finisher, and structured-invocation tests pass.
