LLM JSON Stage Contract

Purpose: Define the required pattern for any LLM flow that returns JSON used by runtime logic, persistence, ranking, cleanup, policy decisions, or downstream automation.

Scope: Applies to runtime and admin flows when LLM JSON is persisted, reused by later prompts, or consumed by application code for automated branching.

Core Rule:

- Do not treat high-value LLM JSON as a one-shot response.
- JSON shape is owned by code, preferably Zod schemas passed to AI SDK structured output with `Output.object({ schema })`.
- Prompt text may describe task behavior and compact output policy, but must not carry hardcoded full key/type JSON schema blocks.
- App code must validate and repair JSON before persistence, ranking, cleanup, automation, or deterministic rendering.
- Active flows do not use `schema_repair`, `quality_audit`, `quality_repair`, or finish-continuation stages.
- Shared repair is limited to deterministic syntax salvage plus shared `field_patch`.

## Invocation Layers

Use two distinct layers:

1. `invokeLLMRaw`
   - Calls the provider.
   - May pass `modelInput.output = Output.object({ schema })` to AI SDK `generateText`.
   - Returns provider text, object, finish reason, usage, and provider errors.
   - Does not run schema repair.
   - Does not infer JSON from prompts.
   - Is used by pure text calls and by `field_patch` callbacks.

2. `invokeStructuredLLM`
   - Wraps `invokeLLMRaw`.
   - Requires a schema-gate config: schema name, Zod schema, validation rules, allowlisted repair paths, and immutable paths.
   - Forces or preserves `Output.object({ schema })` for the first provider call.
   - Runs the shared schema gate on the provider result.
   - Uses raw repair calls only for `field_patch`, so repair cannot recurse.
   - Returns either a typed valid object or a typed schema failure with debug attempts.

Do not make raw invocation guess that text is JSON. Structured JSON repair is opt-in by schema config.

## When Staging Is Required

Use staged JSON handling when:

- JSON will be written to DB.
- JSON will be reused by later prompts or background jobs.
- JSON affects selection, ranking, cleanup, routing, or policy behavior.
- JSON drives persistence, rendering, notification, automation, or moderation.
- Malformed output would pollute durable state.

Staging is usually not required when:

- The output is pure prose.
- The JSON is low-risk and immediately discarded if invalid.
- A deterministic fallback fully replaces invalid output.
- The result does not affect persisted state or automated decisions.

## Standard Stage Model

Use this model for app-owned JSON:

1. `main`
   - LLM generates the canonical JSON candidate.
   - For structured JSON, call `invokeStructuredLLM`.

2. `schema_gate`
   - Prefer provider `object` when available.
   - If needed, parse raw text.
   - If the raw text is structurally incomplete, try deterministic syntax salvage.
   - Apply loose schema-owned normalization.
   - Validate against the original Zod schema.
   - If the JSON is parseable but schema-invalid on allowlisted paths, run `field_patch`.
   - Return typed valid object or typed schema failure.

3. `deterministic_checks`
   - App-owned checks for concrete constraints not already normalized by schema.
   - Examples: duplicates, missing required evidence, invalid references, impossible state.

4. `deterministic_render`
   - Application renders final persisted text or derived structures from validated JSON.

Recommended template:

```text
main -> schema_gate -> deterministic_checks -> deterministic_render
```

If a flow retries main generation, treat that as retry bookkeeping around the same stage, not as a separate repair stage.

## Code-Owned Schema Rules

- Define JSON shape in code with Zod.
- Pass Zod schemas to AI SDK structured output through `Output.object({ schema })` when provider support allows it.
- Keep prompt output policy compact:

```text
Structure is enforced by the code-owned Zod schema through AI SDK Output.object.
Return only the schema-bound object.
No markdown wrapper, comments, or explanation.
```

- Do not put full JSON skeletons or key/type schema examples in production prompts.
- Do not add `assertExactKeys` for generated model JSON outputs.
- Unknown generated-output keys should be stripped or ignored by schema parsing unless a specific internal app-authored object requires exact-key validation.
- Patch outputs are different: unknown patch paths must be rejected because patch paths can mutate app-owned data.

## Loose Generated-Output Policy

Generated model JSON should be strict where correctness matters and forgiving where overflow is harmless.

Default policy:

- Missing required fields: invalid, then `field_patch` if the path is allowlisted.
- Wrong field type: invalid, then `field_patch` if the path is allowlisted.
- Extra generated keys: strip or ignore; do not fail only because extras are present.
- Overlong arrays: truncate to the first allowed items when schema policy says overflow is harmless.
- Too few array items: invalid if the schema minimum is not met.
- App-owned IDs, timestamps, source IDs, row scope, and write-method flags should be deterministic, not model-authored.

For writer-output self-rating metadata:

- `metadata.probability` is observational AI self-rating metadata.
- Missing, non-integer, or out-of-range values should normalize to `0`.
- Do not start repair only because `metadata.probability` is missing or invalid.

## Shared Schema Gate

The shared schema gate must be flow-agnostic and should receive:

```ts
type SharedJsonSchemaGateInput<T> = {
  flowId: string;
  stageId: string;
  rawText: string;
  rawObject?: unknown;
  finishReason: string | null;
  generationErrorName?: string | null;
  generationErrorMessage?: string | null;
  schemaName: string;
  schema: z.ZodType<T>;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
  invokeFieldPatch?: (input: FieldPatchInvocationInput) => Promise<FieldPatchInvocationResult>;
};
```

Required behavior:

1. Prefer `rawObject` when provider structured output is available.
2. If object validation succeeds, return typed value.
3. If object validation fails and raw text exists, continue with raw text extraction/repair.
4. Extract JSON from raw text.
5. If parsing fails but the text has a usable structurally incomplete prefix, try deterministic syntax salvage.
6. If salvage makes the payload parseable, continue.
7. If the payload is still not parseable, return typed schema failure and debug metadata.
8. Apply loose schema-owned normalization before validation.
9. Validate the original schema.
10. If parseable JSON is schema-invalid, call `field_patch` for allowlisted paths only.
11. Re-run loose normalization and full schema validation after `field_patch`.
12. If still invalid, return typed schema failure and debug metadata.

Debug metadata should include:

- flow id
- stage id
- schema name
- attempt stage
- finish reason
- normalized failure reason
- likely open path when salvage was attempted
- required remaining paths
- repairable paths
- compact error summary

## Syntax Salvage

Syntax salvage is deterministic structure repair before `field_patch`.

Rules:

- It may only append structural closers that make an incomplete prefix parseable.
- Allowed operations:
  - close an already-open string with `"`
  - close an open array with `]`
  - close an open object with `}`
  - append the required closing stack in order
- It must not invent semantic values:
  - no placeholder strings
  - no auto-filled missing field values
  - no fake array items
  - no fabricated required fields
- `field_patch` must not run until the payload is parseable JSON.
- If there is no usable prefix, fail closed rather than asking for continuation.

Length-like failures still matter for diagnostics, but active flows do not use finish-continuation as a follow-up stage.

## FieldPatch Repair

`field_patch` is for parseable JSON that fails schema validation on allowlisted missing or invalid fields.

Rules:

- `field_patch` repair must call raw invocation, not structured invocation.
- The patch prompt names only failing paths and repairable paths.
- The patch prompt must not include a hardcoded full key/type JSON schema.
- Patch output must be schema-bound by a small patch schema, such as an operation list:

```ts
const FieldPatchRepairSchema = z.object({
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

- Each patch path must be checked against:
  - actual failing or missing paths
  - `allowedRepairPaths`
  - `immutablePaths`
  - prototype-pollution segments: `__proto__`, `prototype`, `constructor`
- Wildcards may be used in allowlists, for example `candidates.*.title`.
- Patch values should be validated against inferred leaf schemas when reliable.
- Merge the patch into the original parsed object.
- Re-run full schema validation after merge.

Unknown generated-output keys are allowed to be stripped, but unknown patch paths must be rejected.

## Deterministic Checks

Use deterministic checks for concrete issues that should not require model judgment, such as:

- duplicate items
- invalid references
- missing source evidence
- invalid app-owned metadata
- impossible state transitions
- policy constraints that are not expressible in schema

Do not use deterministic checks for issues that are already handled by loose schema normalization:

- harmless extra generated keys
- overlong arrays that are intentionally truncated
- missing or invalid `metadata.probability`

## Failure Handling

- Bound repair attempts.
- Do not persist malformed JSON after terminal schema or deterministic failure.
- Prefer a typed failure over silently fabricating fallback content.
- Preserve distinct failure categories:
  - transport failure
  - empty length-like output
  - schema failure
  - deterministic check failure

## Checklist

- Code-owned Zod schema exists.
- Structured output uses `Output.object({ schema })` when provider support allows it.
- Prompt has no hardcoded full key/type schema block.
- Raw invocation can pass provider structured output schema.
- Structured invocation runs the shared schema gate.
- Repair callbacks use raw invocation only.
- Extra generated keys are stripped or ignored.
- Overlong generated arrays are truncated when harmless.
- Missing or invalid required fields are repaired only through allowlisted `field_patch`.
- Immutable paths cannot be patched.
- Unknown patch paths are rejected.
- Structurally incomplete JSON uses deterministic syntax salvage only.
- `field_patch` starts only after parseability.
- No usable prefix returns typed schema failure or transport/token diagnostic.
- Debug records expose schema-gate attempts compactly.
- App-owned metadata and final render are deterministic.
- Stage budgets are calibrated from actual output sizes.

Current In-Repo References:

- The old `flow-audit-repair-examples.md` has been superseded. See the removal plan: [2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md)
- Code-owned output contract builders: [persona-v2-flow-contracts.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts) -- Zod schemas are defined here and passed to AI SDK `Output.object({ schema })` for schema enforcement.
- Shared schema gate (deterministic syntax salvage + field_patch): [schema-gate.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/schema-gate.ts)
- Field-patch schema for allowlisted repair: [field-patch-schema.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/field-patch-schema.ts)
- Response finisher (deterministic render): [response-finisher.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/response-finisher.ts)
- Persona generation contract: [persona-generation-contract.md](/Users/neven/Documents/projects/llmbook/docs/ai-agent/llm-flows/persona-generation-contract.md)

Last Updated: 2026-05-11

Verification commands:

- Use focused `vitest` for touched structured-output modules while implementing.
- Use `npm run verify` before completing implementation work.
