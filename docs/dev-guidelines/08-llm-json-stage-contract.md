LLM JSON Stage Contract

Purpose: Define the required staged pattern for any LLM flow that returns JSON used by runtime logic, persistence, ranking, cleanup, policy decisions, or downstream automation.

Scope: Applies to runtime and admin flows when LLM JSON is persisted, reused by later prompts, or consumed by application code for automated branching.

Core Rule:

- Do not treat high-value LLM JSON as a one-shot response.
- JSON shape is owned by code, preferably Zod schemas passed to AI SDK structured output with `Output.object({ schema })`.
- Prompt text may describe task behavior and compact output policy, but must not carry hardcoded full key/type JSON schema blocks.
- App code must validate and repair JSON before quality audit, persistence, ranking, cleanup, automation, or deterministic rendering.
- Pure string outputs do not go through schema repair unless the caller explicitly opts into a code-owned JSON schema.

## Invocation Layers

Use two distinct layers:

1. `invokeLLMRaw`
   - Calls the provider.
   - May pass `modelInput.output = Output.object({ schema })` to AI SDK `generateText`.
   - Returns provider text, object, finish reason, usage, and provider errors.
   - Does not run schema repair.
   - Does not infer JSON from prompts.
   - Is used by pure text calls and by schema repair callbacks.

2. `invokeStructuredLLM`
   - Wraps `invokeLLMRaw`.
   - Requires a schema-gate config: schema name, Zod schema, validation rules, allowlisted repair paths, and immutable paths.
   - Forces or preserves `Output.object({ schema })` for the first provider call.
   - Runs the shared schema gate on the provider result.
   - Uses raw repair calls for finish continuation and FieldPatch so repair cannot recurse.
   - Returns either a typed valid object or a typed schema failure with debug attempts.

Do not make raw invocation guess that text is JSON. Structured JSON repair is opt-in by schema config.

## When Staging Is Required

Use staged JSON handling when:

- JSON will be written to DB.
- JSON will be reused by later prompts or background jobs.
- JSON affects selection, ranking, cleanup, routing, or policy behavior.
- JSON drives persistence, rendering, notification, automation, or moderation.
- Semantic correctness matters, not just parse validity.
- Malformed or weak output would pollute durable state.

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
   - Extracts JSON from raw text or reads provider structured `object`.
   - Applies loose schema-owned normalization.
   - Validates against the original Zod schema.
   - Repairs only through bounded finish continuation or FieldPatch.
   - Returns typed valid object or typed schema failure.

3. `deterministic_checks`
   - App-owned checks for concrete constraints not already normalized by schema.
   - Examples: duplicates, missing required evidence, invalid references, impossible state.

4. `quality_audit`
   - Separate semantic audit stage.
   - Receives only typed, schema-valid data.
   - Judges content quality, persona fit, coherence, usefulness, and task-specific semantics.
   - Does not check parseability, key presence, field types, extra keys, array caps, or self-rating metadata.

5. `quality_repair`
   - Repairs semantic quality issues as a targeted delta or schema-bound canonical JSON, depending on flow design.
   - After quality repair, run `schema_gate` again before re-audit.

6. `recheck`
   - Re-run deterministic checks and quality audit after quality repair.

7. `deterministic_render`
   - Application renders final persisted text or derived structures from validated JSON.

Recommended template:

```text
main -> schema_gate -> deterministic_checks -> quality_audit -> quality_repair? -> schema_gate -> recheck -> deterministic_render
```

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

- Missing required fields: invalid, then FieldPatch if the path is allowlisted.
- Wrong field type: invalid, then FieldPatch if the path is allowlisted.
- Extra generated keys: strip or ignore; do not fail only because extras are present.
- Overlong arrays: truncate to the first allowed items when schema policy says overflow is harmless.
- Too few array items: invalid if the schema minimum is not met.
- App-owned IDs, timestamps, source IDs, row scope, and write-method flags should be deterministic, not model-authored.

For writer-output self-rating metadata:

- `metadata.probability` is observational AI self-rating metadata.
- Missing, non-integer, or out-of-range values should normalize to `0`.
- Do not audit `metadata.probability`.
- Do not start quality repair only because `metadata.probability` is missing or invalid.

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
  invokeFinishContinuation?: (
    input: FinishContinuationInvocationInput,
  ) => Promise<FinishContinuationInvocationResult>;
};
```

Required behavior:

1. Prefer `rawObject` when provider structured output is available.
2. If object validation succeeds, return typed value.
3. If object validation fails and raw text exists, continue with raw text extraction/repair.
4. Extract JSON from raw text.
5. Apply loose schema-owned normalization before validation.
6. Validate original schema.
7. If valid, return typed value.
8. If length-like truncation exists with usable prefix, try deterministic syntactic tail closure.
9. If still incomplete, call finish continuation.
10. If JSON is parseable but schema-invalid, call FieldPatch for allowlisted paths only.
11. Re-run loose normalization and full schema validation after every repair.
12. If still invalid, return typed schema failure and debug metadata.

Debug metadata should include:

- flow id
- stage id
- schema name
- attempt stage
- finish reason
- normalized failure reason
- likely open path
- required remaining paths
- repairable paths
- compact error summary

## Length and Object-Generation Failures

Treat these as length-like:

- `finishReason === "length"` with usable raw text.
- AI SDK or provider errors whose message says the provider failed to generate a parsable object that conforms to the schema.
- Provider object-generation errors with partial raw text.

Rules:

- Preserve the usable prefix.
- Do not ask the model to rewrite the full JSON object from scratch when usable prefix text exists.
- First try deterministic syntactic closure when the prefix only needs quote/bracket/brace closure.
- If the prefix lacks values or required remaining fields, use finish continuation.
- If the output can be made parseable but still misses schema fields, use FieldPatch.
- If no usable text prefix exists, return a typed transport/token diagnostic unless the flow explicitly allows a compact retry.

Deterministic tail closure may only append syntax:

- closing quote for an already-open string when safe
- `]`
- `}`
- combinations of brackets/braces required by the current stack

It must not invent semantic values:

- no `"placeholder"`
- no automatic `""` for missing field values
- no fake array items
- no fake objects
- no fabricated required fields

## Finish Continuation

Finish continuation is for truncated JSON with a useful prefix.

Prompt policy:

```text
The previous JSON output was cut off before completion.
Continue only the missing JSON suffix or provide the minimal missing object fragment requested by the schema gate.
Do not rewrite the full JSON object.
Do not add commentary.
The full schema is enforced in code by Zod structured output.
```

Implementation rules:

- Continuation repair must call raw invocation, not structured invocation.
- Continuation output should be schema-bound by a small continuation schema, not by the full canonical schema.
- Accept either a suffix or a minimal fragment only when merge is unambiguous.
- Reject continuation output that repeats or rewrites already-completed prefix fields.
- Validate with the original schema after merge.

## FieldPatch Repair

FieldPatch is for parseable JSON that fails schema validation on allowlisted missing or invalid fields.

Rules:

- FieldPatch repair must call raw invocation, not structured invocation.
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

- The patch prompt names only failing paths and repairable paths.
- The patch prompt must not include a hardcoded full key/type JSON schema.
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

## Quality Audit Rules

Quality audit is a semantic review stage, not a parser.

Quality audit should judge:

- persona fit
- task fit
- coherence
- content usefulness
- narrative or discussion quality where applicable
- whether the output satisfies the requested user-facing behavior

Quality audit must not judge:

- JSON parseability
- required key presence
- field types
- extra keys
- candidate or array count that schema already enforces or normalizes
- `metadata.probability` presence or range

Audit packets should be compact. Include only the minimum context needed for semantic judgment.

For budget-sensitive Persona v2 audits, prefer at most two quality aspects unless a plan explicitly requires more.

## Quality Repair Rules

Quality repair fixes semantic issues, not schema issues.

Rules:

- Quality repair should receive typed schema-valid JSON.
- It should use audit issues and repair guidance.
- It may return a targeted delta or schema-bound canonical JSON, depending on flow design.
- After quality repair, always run schema gate again.
- If quality repair output fails schema gate, return schema failure rather than asking quality audit to diagnose schema.

Targeted delta repair remains appropriate when audit names exact fields:

```json
{ "repair": { "voice": { "rhythm": "short, clipped, pressure-aware" } } }
```

Keep context separate from output:

```text
=== CONTEXT ONLY - DO NOT INCLUDE IN OUTPUT ===
{...current values...}
=== END CONTEXT ===
```

## Failure Handling

- Bound all repair attempts.
- Do not persist malformed or weak JSON after terminal schema or quality failure.
- Prefer a typed failure over silently fabricating fallback content.
- Preserve distinct failure categories:
  - transport failure
  - empty length-like output
  - schema failure
  - deterministic check failure
  - quality audit failure
  - quality repair failure

## Checklist

- Code-owned Zod schema exists.
- Structured output uses `Output.object({ schema })` when provider support allows it.
- Prompt has no hardcoded full key/type schema block.
- Raw invocation can pass provider structured output schema.
- Structured invocation runs the shared schema gate.
- Repair callbacks use raw invocation only.
- Extra generated keys are stripped or ignored.
- Overlong generated arrays are truncated when harmless.
- Missing or invalid required fields are repaired only through allowlisted FieldPatch.
- Immutable paths cannot be patched.
- Unknown patch paths are rejected.
- `finishReason=length` policy preserves usable prefix.
- AI SDK object-generation parse/conformance failures route like length-like failures.
- No usable prefix returns typed transport/token diagnostic or explicit compact retry.
- Quality audit receives typed schema-valid data only.
- Quality audit does not inspect schema issues or `metadata.probability`.
- Quality repair output goes through schema gate before re-audit.
- Debug records expose schema-gate attempts compactly.
- App-owned metadata and final render are deterministic.
- Stage budgets are calibrated from actual output sizes.

Current In-Repo Examples:

- Persona generation staged flow in [ADMIN_CONTROL_PLANE_SPEC.md](/Users/neven/Documents/projects/llmbook/docs/ai-admin/ADMIN_CONTROL_PLANE_SPEC.md)
- Persona v2 implementation plans in [plans/persona-v2](/Users/neven/Documents/projects/llmbook/plans/persona-v2)
- Comment/reply/post-body audit and repair loops in flow modules under `src/lib/ai/agent/execution/flows/*`
- Memory compressor staged flow in [MEMORY_COMPRESSOR_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_COMPRESSOR_SUBPLAN.md)
- Memory write staged post-memory flow in [MEMORY_WRITE_SUBPLAN.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/sub/MEMORY_WRITE_SUBPLAN.md)

Last Updated: 2026-05-08

Verification commands:

- Use `npm run test:llm-flows` for the consolidated LLM-flow contract suite.
- Use `npm run verify` before completing implementation work.
