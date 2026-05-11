# PatchSchema FieldPatch DeepSeek Implementation Plan

> **For DeepSeek:** implement this task-by-task. Keep the scope limited to schema-gate repair, PatchSchema handling, loose JSON normalization, and wiring existing JSON-producing Persona v2 flows through the shared gate. Do not redesign Persona content prompts beyond removing obsolete schema/key prompt text where the task explicitly says so.
> **Status:** Superseded for active implementation. Historical notes about dynamic patching and loose normalization remain useful, but the finish-continuation state machine described here is no longer the active contract. Use `docs/dev-guidelines/08-llm-json-stage-contract.md` for the current repair boundary.

**Goal:** Replace the current placeholder FieldPatch behavior with a reliable schema-bound repair framework that handles `finishReason=length`, AI SDK object-generation parse failures, dynamic missing-field patching, loose extra-key stripping, and overlong-array normalization before any audit or downstream runtime logic consumes LLM JSON.

**Architecture:** Zod remains the source of truth for JSON shape. AI SDK structured output uses `generateText({ output: Output.object({ schema }) })`; prompt text should contain task behavior and compact output policy only, not full key/type JSON schemas. The shared schema gate becomes a small state machine: extract/parse, normalize, validate, finish truncated output when possible, request a field patch only for allowlisted missing/invalid paths, merge the patch, then validate with the original schema.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` with `Output.object`, Zod, Persona Core v2, shared JSON repair utilities, Vitest.

---

## Current Code State

- `src/lib/ai/json-repair/schema-gate.ts` has `runSharedJsonSchemaGate`, but `tryFieldPatch` currently mutates failing paths to `null`; it does not call an LLM, does not build a dynamic PatchSchema, and does not merge a schema-bound patch response.
- `src/lib/ai/json-repair/schema-gate.test.ts` has a local `PatchSchema` test fixture only. It is not a production dynamic patch schema builder.
- `src/lib/ai/json-repair/response-finisher.ts` can classify truncation, but deterministic tail closure can currently add placeholder semantic content for trailing-comma cases. That must be removed.
- `finish_continuation` is only recorded as debug metadata in `schema-gate.ts`; it is not implemented.
- `stripExtraKeys` and `normalizeOverlongArrays` are no-ops.
- `src/lib/ai/prompt-runtime/action-output.ts` still rejects extra top-level keys manually.
- `src/lib/ai/admin/persona-generation-preview-service.ts` still uses rewrite-from-scratch retry prompts for truncation. That conflicts with the new framework.
- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts` has code-owned Zod schemas, but still contains hardcoded output contract prompt text and strict array `.max(...)` behavior without truncate-first normalization.

## Non-Negotiable Rules

- Do not ask the model to regenerate the full JSON object for `finishReason=length` when usable partial text exists.
- Treat AI provider errors like "failed to generate a parsable object that conforms to the schema" as `object_generation_unparseable`, then route them like `finishReason=length`.
- If there is no usable text prefix, return a typed transport/token diagnostic unless the caller explicitly allows a compact retry.
- Tail closure may only append syntactic suffixes: quote, bracket, brace, and required commas only when already syntactically implied. It must not invent string values, placeholder values, array items, or semantic fields.
- FieldPatch may only request missing or invalid allowlisted paths.
- Immutable paths must never be patched.
- Extra keys in generated model JSON must not fail validation if the code-owned schema can strip them.
- Overlong arrays should be truncated to the first allowed items before validation when the schema policy allows it.
- `metadata.probability` is AI self-rating metadata. Normalize invalid/missing values to `0`; do not audit it and do not let it cause quality repair loops.
- Audits must never check JSON parseability, field types, extra keys, array count, or `metadata.probability`.
- Do not add `assertExactKeys` for generated model JSON outputs.

---

## Target FieldPatch Flow

```text
first LLM output
  -> extract JSON
  -> loose normalize
  -> validate original Zod schema
  -> if valid: return typed object
  -> if length-like truncation and prefix exists:
       deterministic syntactic tail closure
       -> validate original schema
       -> if still incomplete: finish-continuation LLM
       -> merge completed suffix/object
       -> validate original schema
  -> if parseable but schema-invalid:
       collect Zod issues
       classify missing/invalid paths
       filter to allowedRepairPaths minus immutablePaths
       build dynamic patch schema for only those paths
       invoke repair LLM with Output.object({ schema: patchSchema })
       merge patch into original parsed object
       loose normalize
       validate original Zod schema
  -> if still invalid: return typed schema_failure with debug attempts
```

---

## Task 1: Lock Current Behavior With Failing Tests

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate.test.ts`
- Modify: `src/lib/ai/json-repair/response-finisher.test.ts` if it exists; otherwise create it.

**Steps:**

1. Add a test proving current placeholder FieldPatch behavior is insufficient.
   - Input: parseable JSON missing a required allowlisted field.
   - Expected after implementation: schema gate invokes patch adapter, receives only missing field(s), merges, validates.
   - Before implementation this should fail because current code sets missing fields to `null`.

2. Add a test for invalid allowlisted field patch.
   - Input: `{"name":"Alice","age":"thirty"}` with `age` allowlisted.
   - Patch adapter returns `{ "age": 30 }`.
   - Expected: final object has `age: 30`.

3. Add a test for immutable path protection.
   - Input has invalid `identity.archetype` or another immutable path.
   - Even if the patch adapter could supply a value, schema gate must fail before invoking patch.

4. Add a test for wildcard path matching.
   - Example failure path: `candidates.0.title`.
   - Allowlist: `candidates.*.title`.
   - Expected: path is repairable.

5. Add a test for extra keys.
   - Input includes a valid object plus extra top-level and nested keys.
   - Expected: parsed result strips or ignores extras and returns valid.

6. Add a test for overlong arrays.
   - Input includes arrays over max length, such as `tags` with 7 items or `reference_style.reference_names` with 8 items.
   - Expected: first allowed items are kept, no schema failure.

7. Add a test for `metadata.probability`.
   - Missing, string, float, negative, and over-100 values normalize to `0`.
   - No audit or quality-repair path should be involved.

8. Add a test for deterministic tail closure.
   - A prefix that only needs `]}` or `}` should close.
   - A prefix ending after `"field":` or trailing comma requiring a new value must not invent `"placeholder"` or `""`; it should route to continuation.

9. Add a test for `object_generation_unparseable`.
   - Error message contains "failed to generate a parsable object that conforms to the schema".
   - With usable raw text, expected route is same as `finishReason=length`.
   - With empty raw text, expected result is typed transport/token diagnostic.

10. Run:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/json-repair/response-finisher.test.ts
```

Expected: new tests fail before implementation.

---

## Task 2: Define Schema Gate Contracts for Patch and Continuation

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate-contracts.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.ts`

**Implementation requirements:**

1. Extend `SharedJsonSchemaGateInput<T>` with optional injected callbacks:

```ts
invokeFieldPatch?: (input: FieldPatchInvocationInput) => Promise<FieldPatchInvocationResult>;
invokeFinishContinuation?: (
  input: FinishContinuationInvocationInput,
) => Promise<FinishContinuationInvocationResult>;
```

2. Add typed contracts:

```ts
export type SchemaGateAttemptStage =
  | "initial_parse"
  | "loose_normalize"
  | "deterministic_tail_closure"
  | "finish_continuation"
  | "field_patch"
  | "final_validate";

export interface FieldPatchInvocationInput {
  schemaName: string;
  flowId: string;
  stageId: string;
  originalJson: Record<string, unknown>;
  failingPaths: string[];
  repairablePaths: string[];
  patchSchema: z.ZodTypeAny;
  validationSummary: string;
}

export interface FieldPatchInvocationResult {
  patch: Record<string, unknown>;
  rawText?: string | null;
  finishReason?: string | null;
}

export interface FinishContinuationInvocationInput {
  schemaName: string;
  flowId: string;
  stageId: string;
  partialJsonText: string;
  likelyOpenPath: string | null;
  requiredRemainingPaths: string[];
  validationSummary: string;
}

export interface FinishContinuationInvocationResult {
  text: string;
  finishReason?: string | null;
}
```

3. Keep callback contracts generic. Do not import Persona-specific modules into the shared schema gate.

4. Update debug metadata so every repair attempt records:
   - attempt stage
   - finish reason
   - likely open path
   - required remaining paths
   - repairable paths where relevant
   - compact error summary

5. Run TypeScript checks for the touched files through the project’s normal verification command after implementation.

---

## Task 3: Implement Loose Normalization Before Validation

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify tests from Task 1.

**Implementation requirements:**

1. Replace no-op `stripExtraKeys` with a schema-aware normalizer when possible, or rely on Zod stripping but ensure manual parser paths no longer reject extras for generated model JSON.

2. Implement overlong-array truncation before validation.
   - Prefer schema-owned Zod preprocess/transform helpers for known generated-output schemas.
   - For shared generic gate, support an optional normalization policy map from schema metadata if generic introspection becomes brittle.

3. Add reusable helpers for common generated-output schema fields:

```ts
const looseProbability = z.preprocess(
  (value) => (Number.isInteger(value) && value >= 0 && value <= 100 ? value : 0),
  z.number().int().min(0).max(100),
);

const MetadataSchema = z
  .object({ probability: looseProbability.default(0) })
  .strip()
  .default({ probability: 0 });
```

4. Add a helper for max arrays:

```ts
function truncateArray<T extends z.ZodTypeAny>(itemSchema: T, max: number) {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value.slice(0, max) : value),
    z.array(itemSchema).max(max),
  );
}
```

5. Apply truncate-first behavior to:
   - `reference_style.reference_names`: max 5
   - `reference_style.other_references`: max 8
   - post tags: max 5
   - post plan candidates: max 3
   - body outlines and other existing bounded generated arrays where overflow should not fail the stage.

6. Keep minimum counts meaningful. If truncation leaves too few items, schema should still fail and use FieldPatch if the path is allowlisted.

7. Run:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

Expected: loose normalization tests pass.

---

## Task 4: Build Dynamic Field Patch Schema

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Consider creating: `src/lib/ai/json-repair/field-patch-schema.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`

**Implementation requirements:**

1. Add a helper:

```ts
export function buildFieldPatchSchema(input: {
  rootSchema: z.ZodTypeAny;
  repairablePaths: string[];
}): z.ZodTypeAny;
```

2. The patch schema must allow only the repairable paths.

3. For scalar paths, infer the target leaf schema where practical.
   - Example: `age` should be `z.number().int().min(0).max(150)`, not `z.any()`.

4. For nested paths, build a nested object schema containing only the required repair leaves.

5. For array wildcard paths, use a compact patch representation instead of requiring a full array rewrite. Recommended:

```ts
const FieldPatchOperationSchema = z.object({
  path: z.string(),
  value: z.unknown(),
});

const FieldPatchRepairSchema = z.object({
  repair: z.array(FieldPatchOperationSchema).min(1).max(20),
});
```

Then validate each operation after receipt against the original root schema at the target path.

6. Choose one representation and keep it consistent:
   - Object-shaped patches are simpler for fixed object paths.
   - Operation-list patches are better for arrays and wildcard paths.
   - If using operation-list patches, the LLM output must be schema-bound by `FieldPatchRepairSchema`, and every path/value pair must be allowlist-checked before merge.

7. Implement path matching:

```ts
matchesAllowedPath("candidates.0.title", "candidates.*.title") === true;
matchesAllowedPath("candidates.0.title", "candidates.title") === false;
```

8. Reject patch paths that:
   - are not failing paths or required missing descendants
   - are not allowlisted
   - match immutable paths
   - attempt prototype pollution keys: `__proto__`, `prototype`, `constructor`

9. Add tests for:
   - fixed scalar patch
   - nested object patch
   - wildcard array item patch
   - unknown patch path rejection
   - immutable patch path rejection
   - prototype pollution path rejection

---

## Task 5: Replace Placeholder `tryFieldPatch`

**Files:**

- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`

**Implementation requirements:**

1. Replace `current[lastKey] = null` behavior.

2. New flow:
   - Parse JSON.
   - Loose normalize.
   - Run original schema.
   - Collect Zod issues.
   - Convert issue paths to dot paths.
   - Expand missing object paths where needed.
   - Determine `repairablePaths`.
   - If no repairable paths, return schema failure.
   - If any immutable failures, return schema failure before invoking patch.
   - Build dynamic patch schema.
   - Invoke `input.invokeFieldPatch`.
   - Validate patch output against patch schema.
   - Merge patch into the original parsed object.
   - Loose normalize again.
   - Validate with original schema.

3. If `invokeFieldPatch` is absent, schema gate must not pretend to repair.
   - Return `schema_failure`.
   - Debug summary: `field patch unavailable`.

4. Preserve original parsed fields. Only patch targeted paths.

5. Do not patch fields merely because extra keys exist.

6. Add explicit merge helper tests.

7. Run:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts
```

Expected: all schema-gate tests pass.

---

## Task 6: Implement Finish Continuation

**Files:**

- Modify: `src/lib/ai/json-repair/response-finisher.ts`
- Modify: `src/lib/ai/json-repair/schema-gate.ts`
- Test: `src/lib/ai/json-repair/schema-gate.test.ts`
- Test: `src/lib/ai/json-repair/response-finisher.test.ts`

**Implementation requirements:**

1. Remove deterministic placeholder suffix candidates.
   - No `"placeholder"`.
   - No `""` as invented value after a colon or comma.

2. Classification rules:
   - `tail_closable`: only missing quote/bracket/brace can finish.
   - `continuation_needed`: missing value, missing remaining fields, trailing comma requiring a value, or schema-invalid closed prefix needing model completion.
   - `prefix_too_broken`: empty text or text that cannot be sensibly continued.

3. Add a helper that asks the continuation callback to finish the object.
   - The callback receives partial JSON, likely open path, required remaining paths, and compact validation summary.
   - It must not receive a hardcoded full key/type schema prompt.
   - Code-owned schema still validates final output.

4. Preferred continuation prompt contract for the adapter:

```text
The previous JSON output was cut off before completion.
Continue only the missing JSON suffix or provide the minimal missing object fragment requested by the schema gate.
Do not rewrite the full JSON object.
Do not add commentary.
The full schema is enforced in code by Zod structured output.
```

5. Merge strategy:
   - If continuation returns suffix text, append to partial and parse.
   - If continuation returns a compact object fragment, merge only when the partial JSON is parseable enough to identify the merge target.
   - If merge is ambiguous, fail with typed schema failure instead of rewriting from scratch.

6. Add tests:
   - `finishReason=length` with closable stack succeeds without LLM.
   - `finishReason=length` needing missing fields calls continuation before field patch.
   - continuation result is validated by original schema.
   - continuation failure falls back to FieldPatch only if JSON is parseable enough and missing paths are allowlisted.

---

## Task 7: Wire AI SDK Patch and Continuation Adapters

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify related flow modules that consume JSON from Persona v2 stages.
- Test relevant service tests if present.

**Implementation requirements:**

1. Implement adapter functions near the LLM invocation boundary, not inside generic schema-gate code.

2. FieldPatch adapter:
   - Calls `invokeLLM` / existing model adapter.
   - Uses AI SDK structured output:

```ts
output: Output.object({ schema: patchSchema });
```

- Prompt asks for only repair fields/operations.
- Prompt includes original JSON and validation summary.
- Prompt does not include full schema key/type text.

3. Finish continuation adapter:
   - Calls `invokeLLM`.
   - Uses a compact output schema appropriate for continuation result.
   - Does not ask for full rewrite.

4. Pass adapters into `runSharedJsonSchemaGate` from:
   - one-stage PersonaCoreV2 generation
   - post plan
   - post body
   - comment
   - reply
   - schema repair after quality repair, if that path still returns raw JSON

5. Remove or bypass rewrite-from-scratch truncation prompts in `persona-generation-preview-service.ts`.

6. Ensure every schema-gate failure returns a typed diagnostic visible in existing debug surfaces.

7. Add tests or mocked invocations proving:
   - adapter receives dynamic patch schema
   - adapter is not called for valid JSON
   - adapter is not called for immutable failures
   - finish continuation is attempted before field patch for length-like failures

---

## Task 8: Remove Obsolete Exact-Key Generated-Output Checks

**Files:**

- Modify: `src/lib/ai/prompt-runtime/action-output.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts` only for generated model JSON outputs that are now schema-gated.
- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.ts` only if audit output is migrated to Zod structured output.
- Test relevant parser/contract tests.

**Implementation requirements:**

1. Generated model JSON should be parsed through Zod schemas that strip unknown keys.

2. Remove manual extra-key rejection for generated writer outputs.

3. Keep exact-key checks only for app-authored internal objects where extra keys indicate a developer bug.

4. Do not use `assertExactKeys` for LLM-generated persona, post, comment, reply, schema-repair, or quality-repair JSON outputs.

5. Replace overlong tag/candidate invalidation with truncate-first normalization where required by the new loose schema policy.

6. Run:

```bash
rg -n "assertExactKeys|extra top-level keys found|extra keys.*invalid|Do not add extra keys" src/lib/ai src/app/api/admin/ai/persona-generation
```

Expected: no remaining occurrences in generated-output paths, or each remaining occurrence has a short code comment explaining why it validates app-authored internal data only.

---

## Task 9: Remove Hardcoded Key/Type Prompt Contracts From Persona V2 Output Prompts

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify prompt-family tests.

**Implementation requirements:**

1. Replace full key/type output prompt blocks with short policy text:

```text
Structure is enforced by the code-owned Zod schema through AI SDK Output.object.
Return only the schema-bound object.
No markdown wrapper, comments, or explanation.
```

2. Keep behavior-specific output requirements only where they are not structural schema declarations.
   - Example: body must be markdown text.
   - Example: story mode body must be prose, not synopsis.

3. Do not repeat full JSON skeletons in prompt text.

4. Do not include `metadata.probability` in audit prompt criteria.

5. Update tests to assert:
   - no full key/type JSON schema block in prompt contracts
   - no `Do not add extra keys`
   - markdown field behavior remains stated
   - story mode behavior remains stated

---

## Task 10: Integrate Schema Gate Before Audit

**Files:**

- Modify flow modules that run quality audit after model JSON output.
- Likely files:
  - `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
  - `src/lib/ai/prompt-runtime/post-plan-audit.ts`
  - `src/lib/ai/admin/persona-generation-preview-service.ts`

**Implementation requirements:**

1. Main model output must pass schema gate before quality audit.

2. Quality repair output must pass schema gate before re-audit.

3. Audit receives typed parsed object only.

4. Audit must not inspect:
   - parseability
   - required keys
   - field types
   - extra keys
   - array/candidate count
   - `metadata.probability`

5. If schema gate fails, return schema failure; do not ask quality audit to diagnose schema.

6. Add tests where malformed JSON never reaches audit.

---

## Task 11: Verification

Run the narrow tests first:

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/json-repair/response-finisher.test.ts src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts
```

Then run relevant flow tests:

```bash
npx vitest run src/lib/ai/prompt-runtime src/lib/ai/admin src/lib/ai/agent/execution
```

Then run project verification:

```bash
npm run verify
```

Finally run search checks:

```bash
rg -n "current\\[lastKey\\] = null|placeholder|rewrite from scratch|Do not add extra keys|extra top-level keys found|assertExactKeys" src/lib/ai src/app/api/admin/ai/persona-generation
rg -n "finish_continuation.*not yet implemented|generateObject|streamObject|metadata\\.probability.*audit" src/lib/ai src/app/api/admin/ai/persona-generation
```

Expected:

- No placeholder FieldPatch mutation remains.
- No deterministic tail closure invents semantic values.
- No `finish_continuation not yet implemented` remains.
- No generated-output path rejects extra keys manually.
- No generated-output prompt contains full hardcoded key/type schemas.
- No `metadata.probability` audit criteria remain.
- Focused tests and `npm run verify` pass.

---

## Acceptance Checklist

- [ ] Shared schema gate validates and repairs through code-owned Zod schemas.
- [ ] Dynamic FieldPatch schema or operation schema is used with `Output.object({ schema })`.
- [ ] FieldPatch requests only missing/invalid allowlisted fields.
- [ ] Immutable paths are never patched.
- [ ] Wildcard array paths are matched safely.
- [ ] Patch merge rejects prototype pollution paths.
- [ ] `finishReason=length` with usable text tries deterministic syntactic closure, then continuation, then field patch only when safe.
- [ ] AI SDK object-generation parse/conformance failures route like length-equivalent failures.
- [ ] Empty length-like failures return typed transport/token diagnostics unless compact retry is explicitly allowed.
- [ ] Extra generated-output keys are stripped/ignored, not invalidated.
- [ ] Overlong arrays keep the first allowed items.
- [ ] `metadata.probability` defaults invalid/missing values to `0` and is not audited.
- [ ] Persona generation no longer rewrites full JSON from scratch for truncation with usable prefix.
- [ ] Prompt-family output contracts no longer hardcode full key/type JSON schemas.
- [ ] Audits only inspect content quality/persona fit aspects, not schema shape.
- [ ] Focused Vitest suites pass.
- [ ] `npm run verify` passes.

---

## Implementation Order

1. Write failing tests for FieldPatch, tail closure, loose normalization, and length-equivalent routing.
2. Add schema-gate callback contracts and debug metadata.
3. Implement loose schema normalization.
4. Build dynamic FieldPatch schema/path matching/merge helpers.
5. Replace placeholder `tryFieldPatch`.
6. Implement conservative finish continuation.
7. Wire Persona generation and prompt-runtime flows through schema gate adapters.
8. Remove obsolete exact-key generated-output checks and hardcoded key/type prompt contracts.
9. Move schema validation before audit everywhere.
10. Run focused tests, flow tests, search checks, and `npm run verify`.

Keep each step small. If a task starts requiring broad prompt/runtime redesign, stop and split it into a separate plan instead of expanding this one.
