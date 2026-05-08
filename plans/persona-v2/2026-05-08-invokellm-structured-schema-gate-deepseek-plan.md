# InvokeLLM Structured Schema Gate DeepSeek Implementation Plan

> **For DeepSeek:** implement this task-by-task. Keep the scope limited to LLM invocation layering, structured JSON schema-gate repair, and wiring existing Persona v2 JSON outputs through that gate. Do not redesign persona behavior prompts except where obsolete full-schema prompt text must be removed to avoid conflicting with code-owned schemas.

**Goal:** Make every opt-in structured JSON LLM output pass through one shared schema check and repair path, while pure string outputs continue to use raw text invocation.

**Architecture:** Split provider invocation from structured JSON validation. `invokeLLMRaw` calls the provider and may pass `output: Output.object({ schema })` to AI SDK `generateText`, but it does not run schema-gate repair. `invokeStructuredLLM` wraps `invokeLLMRaw`, requires a code-owned Zod schema plus repair metadata, runs `runSharedJsonSchemaGate`, and uses raw repair calls for finish continuation and FieldPatch so repair does not recurse.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` with `Output.object`, Zod, shared JSON repair utilities, Persona Core v2 prompt-runtime flows, Vitest.

---

## Clarified Design Rule

Yes: the raw provider call still needs to support `output: Output.object({ schema })`.

But there are two different schema uses:

1. **Provider structured output schema**
   - Lives on `invokeLLMRaw` / provider `generateText`.
   - Passed as `modelInput.output`.
   - Helps the provider produce a structured object.
   - Does not by itself guarantee app-safe JSON.

2. **App schema gate**
   - Lives in `invokeStructuredLLM`.
   - Receives raw text/object/error/finishReason from `invokeLLMRaw`.
   - Extracts JSON, normalizes, validates, repairs, and returns a typed object or typed schema failure.
   - Owns `finishReason=length`, `object_generation_unparseable`, FieldPatch, immutable path rules, array truncation, and debug attempts.

Do not make raw invocation guess that a pure string is JSON. Only run schema gate when the caller opts in with a schema-gate config.

---

## Current Implementation Status

### Already Present

- `src/lib/ai/llm/types.ts` already allows provider structured output through `LlmGenerateTextInput.output`.
- `src/lib/ai/llm/invoke-llm.ts` already forwards `modelInput` to provider calls and returns `object`.
- `src/lib/ai/json-repair/schema-gate.ts` has `runSharedJsonSchemaGate`.
- `src/lib/ai/json-repair/schema-gate.ts` has callback slots for `invokeFieldPatch` and `invokeFinishContinuation`.
- `src/lib/ai/json-repair/field-patch-schema.ts` exists.
- `src/lib/ai/json-repair/schema-gate-adapters.ts` exists.
- Persona interaction stages use AI SDK `Output.object` for some main/quality-repair stages.
- Persona generation preview uses `Output.object({ schema: PersonaCoreV2Schema })` for `persona_core_v2` first attempt.

### Not Complete / Must Fix

- `invokeLLM` does not have a schema-gate opt-in config and does not call `runSharedJsonSchemaGate`.
- There is no separate `invokeLLMRaw` vs `invokeStructuredLLM` boundary.
- `runSharedJsonSchemaGate` is only used in tests, not wired into runtime or admin flows.
- `schema-gate-contracts.ts` currently has duplicate exported type definitions. Clean this before adding more API.
- `stripExtraKeys` and `normalizeOverlongArrays` in `schema-gate.ts` are still no-ops.
- `buildFieldPatchSchema` currently returns the generic `FieldPatchRepairSchema` and does not validate patch values against the original leaf schema.
- `createFieldPatchAdapter` exists, but runtime call sites do not pass it into the schema gate.
- `createFinishContinuationAdapter` currently uses `FieldPatchRepairSchema` even though finish continuation should return a suffix or minimal continuation object. It is not wired into call sites.
- `persona-generation-preview-service.ts` still uses rewrite-from-scratch retry prompts for truncation with usable partial text.
- `action-output.ts` and some legacy contract parsers still reject extra generated keys manually.
- Existing focused Vitest tests pass, but `npm run typecheck` currently stops on a TypeScript 6 `baseUrl` deprecation in `tsconfig.json`; that is unrelated to schema-gate behavior but blocks full verification until addressed or bypassed with the project-approved TS option.

---

## Target API

### Raw Invocation

`invokeLLMRaw` should be the provider call only:

```ts
export async function invokeLLMRaw(input: InvokeLlmRawInput): Promise<InvokeLlmOutput> {
  // existing provider routing, fallback, timeout, retries, recording
  // forwards input.modelInput.output to provider generateText
  // returns text, object, finishReason, error, errorDetails
}
```

Rules:

- Accept `modelInput.output`.
- Pass `output` through to provider `generateText`.
- Never call `runSharedJsonSchemaGate`.
- Never run FieldPatch.
- Never infer JSON from prompt text.
- Used by pure text calls, initial structured calls, FieldPatch repair calls, and finish-continuation repair calls.

### Structured Invocation

Add a schema-gated wrapper:

```ts
export async function invokeStructuredLLM<T>(input: {
  registry: LlmProviderRegistry;
  taskType?: LlmTaskType;
  routeOverride?: { targets?: ProviderRouteTarget[] };
  modelInput: Omit<LlmGenerateTextInput, "modelId">;
  entityId: string;
  timeoutMs?: number;
  retries?: number;
  manualMode?: "auto" | "never";
  recorder?: PromptRuntimeEventRecorder;
  onProviderError?: (event: LlmProviderErrorEvent) => Promise<void> | void;
  schemaGate: {
    schemaName: string;
    schema: z.ZodType<T>;
    validationRules: string[];
    allowedRepairPaths: string[];
    immutablePaths: string[];
    compactRetryAllowed?: boolean;
  };
}): Promise<InvokeStructuredLlmOutput<T>>;
```

Output shape:

```ts
export type InvokeStructuredLlmOutput<T> =
  | {
      status: "valid";
      value: T;
      raw: InvokeLlmOutput;
      schemaGateDebug: SchemaGateDebug;
    }
  | {
      status: "schema_failure";
      error: string;
      raw: InvokeLlmOutput;
      schemaGateDebug: SchemaGateDebug;
    };
```

Wrapper rules:

- Force `modelInput.output = Output.object({ schema })` unless caller already supplied the same schema intentionally.
- Call `invokeLLMRaw` for the first attempt.
- Run `runSharedJsonSchemaGate` with raw text, object when available, finishReason, provider error details, schema metadata, and repair callbacks.
- Repair callbacks must call `invokeLLMRaw`, not `invokeStructuredLLM`.
- Pure string outputs keep using raw invocation.

### Backward Compatibility During Migration

Keep `invokeLLM` as a compatibility alias initially:

- Option A: rename current implementation to `invokeLLMRaw`, then export `invokeLLM = invokeLLMRaw`.
- Option B: keep `invokeLLM` raw and add `invokeStructuredLLM` next to it.

Preferred for lower blast radius:

```ts
export const invokeLLMRaw = invokeLLM;
```

Then migrate structured call sites to `invokeStructuredLLM` one by one.

---

## Task 1: Add Failing Invocation Boundary Tests

**Files:**

- Modify: `src/lib/ai/llm/invoke-llm.test.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.test.ts`
- Create if needed: `src/lib/ai/llm/invoke-structured-llm.test.ts`

**Steps:**

1. Add a test that raw invocation forwards `modelInput.output` to the provider.
   - Mock provider receives `output`.
   - Provider returns `{ text, object, finishReason: "stop" }`.
   - Expected: raw output includes `object`.

2. Add a test that raw invocation does not run schema gate.
   - Provider returns invalid schema object/text.
   - Expected: raw output still returns provider result without repair attempts.

3. Add a test that `invokeStructuredLLM` runs schema gate.
   - Provider returns parseable schema-valid JSON.
   - Expected: status `valid`, typed value returned, schemaGateDebug status `passed`.

4. Add a test that `invokeStructuredLLM` does not run for pure text calls.
   - Call raw invocation without schemaGate config.
   - Expected: no schemaGateDebug.

5. Add a test that structured wrapper repair callbacks use raw invocation.
   - First provider response is schema-invalid.
   - Patch provider response supplies the missing field.
   - Expected: no recursive schema-gate loop; final result is valid.

Run:

```bash
npx vitest run src/lib/ai/llm/invoke-llm.test.ts src/lib/ai/llm/invoke-structured-llm.test.ts src/lib/ai/json-repair/schema-gate.test.ts
```

Expected before implementation: new structured-wrapper tests fail.

---

## Task 2: Clean Schema Gate Contracts

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate-contracts.ts`

**Steps:**

1. Remove duplicated `SchemaGateDebugAttempt`, `SchemaGateDebug`, `SchemaGateResult`, and `BracketState` exports.

2. Keep one canonical set:

```ts
export type SchemaGateAttemptStage =
  | "initial_parse"
  | "loose_normalize"
  | "deterministic_tail_closure"
  | "finish_continuation"
  | "field_patch"
  | "final_validate";
```

3. Ensure `SchemaGateDebugAttempt` supports:
   - `repairablePaths?: string[]`
   - `normalizedFailureReason?: NormalizedJsonFailureReason`
   - optional provider error summary if needed.

4. Ensure `SharedJsonSchemaGateInput<T>` can accept:
   - `rawText`
   - `rawObject?: unknown`
   - `finishReason`
   - `generationErrorName`
   - `generationErrorMessage`
   - schema and schema metadata
   - repair callbacks

5. Run:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts
```

Expected: tests still compile and run.

---

## Task 3: Rename/Wrap Raw Invocation Without Behavior Change

**Files:**

- Modify: `src/lib/ai/llm/invoke-llm.ts`
- Modify: `src/lib/ai/llm/types.ts`
- Test: `src/lib/ai/llm/invoke-llm.test.ts`

**Steps:**

1. Extract the current body of `invokeLLM` to `invokeLLMRaw`.

2. Keep this export for compatibility:

```ts
export async function invokeLLM(input: InvokeLlmRawInput): Promise<InvokeLlmOutput> {
  return invokeLLMRaw(input);
}
```

3. Create shared input type:

```ts
export type InvokeLlmRawInput = {
  registry: LlmProviderRegistry;
  taskType?: LlmTaskType;
  routeOverride?: { targets?: ProviderRouteTarget[] };
  modelInput: Omit<LlmGenerateTextInput, "modelId">;
  entityId: string;
  timeoutMs?: number;
  retries?: number;
  manualMode?: "auto" | "never";
  recorder?: PromptRuntimeEventRecorder;
  onProviderError?: (event: LlmProviderErrorEvent) => Promise<void> | void;
};
```

4. Confirm `modelInput.output` still passes through unchanged to provider calls.

5. Run:

```bash
npx vitest run src/lib/ai/llm/invoke-llm.test.ts
```

Expected: existing raw invocation tests pass.

---

## Task 4: Implement `invokeStructuredLLM`

**Files:**

- Modify: `src/lib/ai/llm/invoke-llm.ts`
- Modify: `src/lib/ai/llm/types.ts`
- Modify: `src/lib/ai/json-repair/schema-gate-adapters.ts`
- Test: `src/lib/ai/llm/invoke-structured-llm.test.ts`

**Steps:**

1. Add `InvokeStructuredLlmInput<T>` and `InvokeStructuredLlmOutput<T>` types.

2. Implement `invokeStructuredLLM<T>`:
   - Build `structuredModelInput` with `Output.object({ schema })`.
   - Call `invokeLLMRaw`.
   - Call `runSharedJsonSchemaGate`.
   - Return typed valid value or typed schema failure.

3. Build repair callback invokers locally:

```ts
const repairRawInvoker: PatchLlmInvoker = async (repairInput) => {
  return invokeLLMRaw({
    registry: input.registry,
    taskType: input.taskType ?? "generic",
    routeOverride: input.routeOverride,
    modelInput: {
      prompt: repairInput.prompt,
      maxOutputTokens: repairInput.maxOutputTokens,
      temperature: repairInput.temperature,
      output: repairInput.output,
    },
    entityId: repairInput.entityId,
    timeoutMs: input.timeoutMs,
    retries: 0,
    manualMode: input.manualMode,
    recorder: input.recorder,
    onProviderError: input.onProviderError,
  });
};
```

4. Use:
   - `createFieldPatchAdapter(repairRawInvoker, input.entityId)`
   - `createFinishContinuationAdapter(repairRawInvoker, input.entityId)`

5. Do not call `invokeStructuredLLM` inside repair callbacks.

6. Include `raw.object` as an input to schema gate when available so direct structured object success can skip fragile text parsing.

7. Tests:
   - valid `raw.object` succeeds even if text is empty or provider text differs.
   - invalid `raw.object` falls back to raw text/repair if available.
   - provider object-generation error message normalizes to `object_generation_unparseable`.

---

## Task 5: Fix Schema Gate to Prefer Raw Object Then Text

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`

**Steps:**

1. Add object-first validation:
   - If `rawObject` exists, run loose normalize + `schema.safeParse(rawObject)`.
   - If valid, return typed value.
   - If invalid and raw text exists, continue with text repair path.

2. Add loose normalization stage:
   - Strip unknown keys through Zod `.strip()` or schema preprocess.
   - Truncate overlong arrays where schema metadata says overflow is harmless.
   - Normalize invalid/missing `metadata.probability` to `0` for writer outputs.

3. Keep schema gate generic. Prefer schema-owned preprocess helpers in flow contract schemas over brittle Zod introspection.

4. Add debug attempt `loose_normalize` when normalization changes the object.

5. Tests:
   - raw object valid, no text needed.
   - raw object invalid but text repair valid.
   - overlong array becomes valid after normalization.
   - metadata probability cannot cause audit/repair.

---

## Task 6: Finish FieldPatch Implementation

**Files:**

- Modify: `src/lib/ai/json-repair/field-patch-schema.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Modify: `src/lib/ai/json-repair/schema-gate-adapters.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`

**Steps:**

1. Decide on one patch representation.

Preferred:

```ts
export const FieldPatchRepairSchema = z.object({
  repair: z
    .array(
      z.object({
        path: z.string(),
        value: z.unknown(),
      }),
    )
    .min(1)
    .max(20),
});
```

2. Preserve operation-list patches through the adapter. Do not convert operation paths into dotted object keys unless `applyFieldPatch` explicitly expects that.

3. Validate each operation:
   - path matches an actual failing/required path
   - path matches allowed repair metadata
   - path does not match immutable metadata
   - path has no prototype-pollution segment
   - value validates against the inferred leaf schema when inference is reliable

4. Fix wildcard path handling:
   - `candidates.0.title` matches `candidates.*.title`.
   - Numeric array indexes are supported.

5. Do not patch non-failing extra keys.

6. Tests:
   - missing required scalar repaired
   - invalid scalar replaced
   - nested object repaired
   - array item repaired
   - unknown path rejected
   - immutable path rejected
   - prototype path rejected
   - returned value wrong type rejected before final merge or by final schema validation

---

## Task 7: Fix Finish Continuation

**Files:**

- Modify: `src/lib/ai/json-repair/response-finisher.ts`
- Modify: `src/lib/ai/json-repair/schema-gate-adapters.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`
- Create if needed: `src/lib/ai/json-repair/response-finisher.test.ts`

**Steps:**

1. Remove any deterministic closure that invents semantic values:
   - no `"placeholder"`
   - no automatic `""` for missing field values
   - no fake array/object values

2. Tail closure may only append syntax:
   - closing quote for an already-open string when safe
   - `]`
   - `}`
   - combinations of brackets/braces required by the stack

3. For prefixes that end after a colon, dangling comma, incomplete key/value pair, or missing required fields, use finish continuation.

4. Replace continuation adapter output schema. Do not use `FieldPatchRepairSchema`.

Use a small continuation schema:

```ts
const FinishContinuationOutputSchema = z.object({
  suffix: z.string().default(""),
  fragment: z.record(z.string(), z.unknown()).nullable().default(null),
});
```

5. Merge rules:
   - If `suffix` is present, append suffix to partial text and parse.
   - If `fragment` is present and partial JSON can be closed into a parseable object without semantic placeholders, merge fragment and validate.
   - If ambiguous, fail and then use FieldPatch only if JSON is parseable enough.

6. Tests:
   - closable stack succeeds without LLM.
   - missing value does not get placeholder.
   - continuation suffix completes JSON.
   - continuation fragment repairs missing fields after syntactic closure.
   - continuation failure falls back to FieldPatch only when parseable.

---

## Task 8: Wire Persona v2 Runtime Stages to Structured Wrapper

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify flow modules only as required by return type changes.
- Test:
  - `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
  - `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
  - `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`

**Steps:**

1. For Persona v2 generated JSON stages, call `invokeStructuredLLM` instead of raw `invokeLLM`:
   - `post_plan`
   - `post_body`
   - `comment`
   - `reply`
   - quality repair outputs that return canonical JSON

2. Keep audit and pure text stages on raw `invokeLLM` unless they have their own audit Zod schema.

3. Use existing schema metadata:
   - `POST_PLAN_SCHEMA_META`
   - `POST_BODY_SCHEMA_META`
   - `COMMENT_SCHEMA_META`
   - `REPLY_SCHEMA_META`

4. If structured invocation returns `schema_failure`, propagate a typed failure before audit.

5. Include `schemaGateDebug` in existing debug records.

6. Remove unused imports if adapters become internal to `invokeStructuredLLM`.

---

## Task 9: Wire Persona Generation Preview to Structured Wrapper

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify Persona generation contract schema metadata if needed.
- Test relevant admin persona generation preview tests.

**Steps:**

1. For `persona_core_v2`, call `invokeStructuredLLM` with:
   - `PersonaCoreV2Schema`
   - PersonaCoreV2 schema metadata
   - allowed reference/style/thinking/narrative repair paths
   - immutable identity/reference paths as required by product rules

2. Remove rewrite-from-scratch truncation retry for usable partial text.

3. If first output is length-like with usable prefix:
   - schema gate handles syntactic closure
   - schema gate handles finish continuation
   - schema gate handles FieldPatch

4. If first output is empty with length-like error:
   - return typed transport/token diagnostic or use an explicitly marked compact retry policy.

5. After quality repair, pass output through the same schema gate before re-audit.

6. Ensure debug surfaces show schema-gate attempts.

---

## Task 10: Remove Generated-Output Exact-Key and Array-Overflow Failures

**Files:**

- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify generated-output parser tests.

**Steps:**

1. For generated model JSON, do not reject extra top-level keys manually. Let Zod strip unknown keys.

2. Add schema-owned helpers:

```ts
const looseProbability = z.preprocess(
  (value) => (Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0),
  z.number().int().min(0).max(100),
);

function truncateArray<T extends z.ZodTypeAny>(item: T, max: number) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value.slice(0, max) : value),
    z.array(item).max(max),
  );
}
```

3. Apply truncate-first behavior to generated arrays:
   - post tags max 5
   - post plan candidates max 3
   - body outlines max 5
   - PersonaCoreV2 reference names max 5
   - PersonaCoreV2 other references max 8

4. Keep min constraints. Too few items should still fail and FieldPatch can fill missing allowlisted fields.

5. `metadata.probability` invalid/missing normalizes to `0`.

6. Confirm no audit prompt or audit parser checks `metadata.probability`.

---

## Task 11: Remove Hardcoded Full Schema Prompt Text for Structured Outputs

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify prompt family tests.

**Steps:**

1. Replace key/type schema prompt text with:

```text
Structure is enforced by the code-owned Zod schema through AI SDK Output.object.
Return only the schema-bound object.
No markdown wrapper, comments, or explanation.
```

2. Keep behavior-only output guidance:
   - body/markdown fields contain markdown text
   - story mode should produce story prose, not synopsis
   - tags should be hashtags and same language

3. Remove:
   - full JSON skeletons
   - `Do not add extra keys`
   - hardcoded schema key/type blocks

4. Tests:
   - output contract has no full JSON skeleton
   - output contract keeps markdown/story behavior
   - no `metadata.probability` audit criterion

---

## Task 12: Verification

Run focused tests:

```bash
npx vitest run src/lib/ai/llm/invoke-llm.test.ts src/lib/ai/llm/invoke-structured-llm.test.ts src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

Run flow tests:

```bash
npm run test:llm-flows
```

Run typecheck. If TypeScript 6 `baseUrl` deprecation blocks typecheck before schema-gate errors are visible, fix the project config with the minimal approved option:

```json
{
  "compilerOptions": {
    "ignoreDeprecations": "6.0"
  }
}
```

Then run:

```bash
npm run typecheck
npm run verify
```

Run search checks:

```bash
rg -n "runSharedJsonSchemaGate\\(" src/lib/ai
rg -n "current\\[lastKey\\] = null|placeholder|rewrite from scratch|Do not add extra keys|extra top-level keys found|assertExactKeys" src/lib/ai src/app/api/admin/ai/persona-generation
rg -n "finish_continuation.*not implemented|FieldPatchRepairSchema.*finish|metadata\\.probability.*audit" src/lib/ai src/app/api/admin/ai/persona-generation
```

Expected:

- `runSharedJsonSchemaGate` is used by `invokeStructuredLLM`, not only tests.
- `invokeLLMRaw` forwards `Output.object({ schema })` but does not repair.
- `invokeStructuredLLM` owns schema check/repair for opt-in structured JSON.
- Repair callbacks call raw invocation and cannot recurse.
- Pure string outputs bypass schema gate.
- No truncation path with usable partial text rewrites the full JSON from scratch.
- No deterministic tail closure invents semantic placeholder values.
- Generated-output extra keys do not fail validation.
- Overlong generated arrays keep the first allowed items.
- `metadata.probability` defaults invalid/missing values to `0` and is not audited.
- Focused tests, flow tests, typecheck, and verify pass.

---

## Acceptance Checklist

- [ ] Raw invocation supports `modelInput.output` and returns provider `object`.
- [ ] Raw invocation never runs schema-gate repair.
- [ ] Structured invocation always supplies `Output.object({ schema })`.
- [ ] Structured invocation runs shared schema gate.
- [ ] Structured invocation repair callbacks use raw invocation only.
- [ ] Shared schema gate accepts raw object and raw text.
- [ ] Shared schema gate handles `finishReason=length`.
- [ ] Shared schema gate handles AI SDK object-generation parse/conformance failures as length-equivalent.
- [ ] FieldPatch uses allowlisted paths and rejects immutable/prototype/unknown paths.
- [ ] Finish continuation does not use FieldPatch schema and does not rewrite full objects.
- [ ] Persona v2 runtime JSON stages use structured wrapper.
- [ ] Persona generation preview uses structured wrapper for PersonaCoreV2.
- [ ] Generated-output extra keys are stripped/ignored.
- [ ] Overlong arrays are truncated to first allowed items.
- [ ] `metadata.probability` is normalized metadata, not audit input.
- [ ] Hardcoded full key/type prompt contracts are removed from structured outputs.
- [ ] `npm run verify` passes or any unrelated verification blocker is documented with exact error output.

---

## Implementation Order

1. Add failing tests for raw-vs-structured invocation behavior.
2. Clean duplicated schema-gate contracts.
3. Extract `invokeLLMRaw` without behavior change.
4. Add `invokeStructuredLLM`.
5. Make schema gate object-first and normalization-aware.
6. Finish FieldPatch path matching, operation handling, and merge validation.
7. Fix finish continuation schema and merge behavior.
8. Wire Persona v2 runtime stages.
9. Wire Persona generation preview.
10. Remove exact-key/overflow generated-output failures.
11. Remove hardcoded full schema prompt text.
12. Run focused tests, flow tests, typecheck, verify, and search checks.

Keep this migration narrow. Do not migrate low-risk pure text calls into structured invocation unless they already declare a Zod schema and their output is consumed as app-owned JSON.
