# Persona Core v2 DeepSeek Integrated Implementation Plan

> **For DeepSeek:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Persona Core v2 one-stage persona generation, Persona v2 prompt-family static constants, code-owned structured output schemas, and the shared JSON schema repair gate as one coherent runtime migration.

**Architecture:** JSON shape is owned by Zod schemas passed to AI SDK 6 structured output with `generateText({ output: Output.object({ schema }) })`; prompt text carries task behavior and short output policy only. Every LLM JSON output goes through one shared schema gate before audit, persistence, ranking, cleanup, or automation. Persona generation becomes one compact stage that returns one `PersonaCoreV2`, while post/comment/reply flows keep block-based prompts with static task/audit/quality-repair constants and dynamic runtime context.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` with `Output.object`, Zod, Persona Core v2, prompt-runtime flow builders, shared JSON repair utilities, Vitest.

---

## Source Plans To Integrate

Read these plans first and treat this document as the implementation order that reconciles them:

- `plans/persona-v2/2026-05-07-one-stage-persona-generation-prompt-simplification-plan.md`
- `plans/persona-v2/2026-05-07-persona-core-v2-prompt-examples-deepseek-handoff-plan.md`
- `plans/persona-v2/2026-05-07-schema-repair-before-audit-plan.md`

Also read before editing LLM JSON runtime code:

- `docs/dev-guidelines/08-llm-json-stage-contract.md`
- `plans/persona-v2/2026-05-06-persona-core-v2-prompt-family-integration-plan.md`

## Non-Negotiable Rules

- Do not add memory, relationship context, default examples, or reference imitation.
- Do not expose chain of thought, scratchpad text, hidden thoughts, or step-by-step reasoning.
- Do not keep legacy dual-read or dual-write compatibility for retired Persona v2 fields.
- Do not add DeepSeek-specific runtime branches.
- Do not put hardcoded full key/type JSON schemas in prompts.
- Do not use deprecated `generateObject` or `streamObject` for new structured-output code.
- Do not let audit validate generated-output schema, required keys, field types, candidate count, parseability, or metadata shape.
- Do not ask the model to regenerate a full JSON object for invalid JSON or `finishReason=length`.
- Do not implement schema repair as Persona-only code. Persona v2 gets adapters; repair mechanics stay shared.
- Do not implement exact-key schema validation for generated model outputs. Extra model keys are stripped during parse/normalization, not treated as schema failure.
- Do not add `assertExactKeys` for model JSON outputs.

## Target Runtime Shape

```text
LLM JSON call
  -> AI SDK structured output with code-owned Zod schema where supported
  -> shared_json_schema_gate
       -> extract + parse + schema validate
       -> if length-like truncation: deterministic tail closure or finish continuation
       -> if parseable schema errors: field patch repair
       -> if valid: typed object
       -> if failed: typed schema failure, no downstream audit
  -> optional quality audit on typed valid object only
  -> optional quality repair with same output schema
  -> shared_json_schema_gate again before re-audit or app-owned consumption
```

Length-like truncation includes:

- `finishReason === "length"` with usable raw text.
- AI SDK structured-output errors where the provider failed to generate a parsable object conforming to the schema and usable raw/partial text exists.

If no usable text prefix exists, treat it like empty `finishReason=length`: return a typed transport/token diagnostic or run an explicitly allowed compact retry.

## Loose Schema Normalization Policy

The schema gate validates required shape and normalizes harmless overflow. It is not an exact-key linter.

Rules:

- Check that required fields exist and conform to the code-owned schema after normalization.
- Strip extra object keys during parse/normalization. Extra keys must not make model output invalid because they do not enter the typed object consumed by app logic.
- Do not use `assertExactKeys` for generated model JSON.
- For arrays with a max length, keep the first allowed items and drop the rest before validation.
- For arrays with a min length, missing or empty arrays remain schema failures or repair targets when allowlisted.
- Keep unknown repair patch paths rejected. This protects the patch mechanism and does not conflict with stripping extra keys from generated model output.
- Keep immutable-path protection for patch merges.
- `metadata.probability` is only AI self-rating metadata. It is schema-owned, may be normalized by the code-owned parser policy, and must never be audited for quality.
- Audit never checks extra keys, array item count, candidate count, or `metadata.probability`.

## Task 1: Convert PersonaCoreV2 To A Code-Owned Zod Schema

**Files:**

- Modify: `src/lib/ai/core/persona-core-v2.ts`
- Modify: `src/lib/ai/core/persona-core-v2.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts`

**Work:**

1. Add failing tests for top-level `persona_fit_probability`.
2. Add failing tests for missing, non-integer, below-0, and above-100 probability.
3. Add failing tests that `reference_style.reference_names` must contain 1 to 5 items.
4. Add failing tests that `reference_style.other_references` must contain 0 to 8 items.
5. Export `PersonaCoreV2Schema` as the canonical Zod schema.
6. Derive `PersonaCoreV2` from `PersonaCoreV2Schema` where practical.
7. Remove `reference_style.do_not_imitate` from types, validators, fallback fixtures, runtime-packet fixtures, and tests.
8. Keep non-imitation as validation/prompt behavior through abstract traits, not a stored boolean.
9. Keep `persona_reference_sources` persistence sourced only from `reference_style.reference_names`.
10. Configure the schema/parser to strip unknown generated-output keys instead of failing exact-key checks.
11. Add tests that `reference_style.do_not_imitate` is stripped from parsed output and never appears in typed Persona v2 data.
12. Normalize overlong `reference_style.reference_names` to the first 5 items and overlong `reference_style.other_references` to the first 8 items before validation.

**Verification:**

```bash
npx vitest run src/lib/ai/core/persona-core-v2.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts
```

## Task 2: Replace Persona Generation With One Compact Stage

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify or create: `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/app/api/admin/ai/persona-generation/preview/route.test.ts`
- Modify: `src/lib/ai/admin/persona-save-payload.test.ts`

**Target prompt block order:**

```text
[task]
[input]
[reference_rules]
[persona_rules]
[fit_probability]
[compactness]
[internal_design_process]
[output_validation]
```

**Work:**

1. Add a failing test that persona generation has exactly one stage, likely `persona_core_v2`.
2. Add a failing test that rendered prompt blocks are exactly the eight target blocks above.
3. Add a failing test that `[output_validation]` contains only short validation reminders and no hardcoded key/type JSON schema text.
4. Replace `seed` plus `persona_core` prompt assembly with the compact one-stage template from the Phase 3 plan.
5. Pass `{{USER_INPUT_CONTEXT}}` and `{{USER_REFERENCE_NAMES}}` as dynamic inputs only.
6. Invoke generation with AI SDK structured output:

```ts
const { output } = await generateText({
  model,
  output: Output.object({ schema: PersonaCoreV2Schema }),
  prompt,
});
```

8. Remove seed-stage reference audit and prior-stage JSON carry-forward.
9. Build existing admin preview/save structures from the single `PersonaCoreV2` object until UI surfaces are simplified.
10. Strip extra keys from persona generation model output before app-owned consumption; do not fail only because extra keys were present.

**Verification:**

```bash
npx vitest run src/lib/ai/admin/persona-generation-prompt-template.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts src/lib/ai/admin/persona-save-payload.test.ts
```

## Task 3: Add Code-Owned Output Schemas For Prompt-Family Flows

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts`
- Modify: `src/lib/ai/prompt-runtime/post-plan-contract.ts`
- Modify: `src/lib/ai/prompt-runtime/post-plan-contract.test.ts`
- Modify or create tests for output schemas near prompt-runtime contracts.

**Work:**

1. Export these main/quality-repair output schemas:
   - `PostPlanOutputSchema`
   - `PostBodyOutputSchema`
   - `CommentOutputSchema`
   - `ReplyOutputSchema`
2. Export these audit-response schemas:
   - `PostPlanDiscussionAuditSchema`
   - `PostPlanStoryAuditSchema`
   - `PostBodyDiscussionAuditSchema`
   - `PostBodyStoryAuditSchema`
   - `CommentDiscussionAuditSchema`
   - `CommentStoryAuditSchema`
   - `ReplyDiscussionAuditSchema`
   - `ReplyStoryAuditSchema`
3. Ensure audit schemas have at most two checks under `checks`.
4. Ensure post body/comment/reply generated content fields are markdown strings.
5. Ensure `metadata.probability` is schema-owned AI self-rating metadata; audit does not validate presence or range.
6. Add schema-derived metadata for:
   - `schemaName`
   - `validationRules`
   - `allowedRepairPaths`
   - `immutablePaths`
7. Add tests that schema-derived repair path metadata contains required nested fields and rejects unknown patch paths.
8. Add tests that output schemas strip extra keys instead of failing exact-key checks.
9. Add tests that overlong arrays are normalized to the first allowed items instead of invalidating the output.
10. Add tests that invalid or missing required fields remain schema failures or repair targets when allowlisted.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-v2-flow-contracts.test.ts src/lib/ai/prompt-runtime/post-plan-contract.test.ts
```

## Task 4: Implement Shared JSON Schema Gate And Repair Utilities

**Files:**

- Create: `src/lib/ai/json-repair/response-finisher.ts`
- Create: `src/lib/ai/json-repair/schema-gate.ts`
- Create: `src/lib/ai/json-repair/schema-gate-contracts.ts`
- Create: `src/lib/ai/json-repair/schema-gate.test.ts`
- Optional modify: `src/lib/ai/admin/llm-flow-shared.ts` only as a compatibility adapter.
- Modify: `src/lib/ai/prompt-runtime/json-parse-utils.ts`
- Modify: `src/lib/ai/prompt-runtime/json-parse-utils.test.ts`

**Contracts:**

```ts
type NormalizedJsonFailureReason = "length" | "object_generation_unparseable" | "other";

type SharedJsonSchemaGateInput<T> = {
  flowId: string;
  stageId: string;
  rawText: string;
  finishReason: string | null;
  generationErrorName?: string | null;
  generationErrorMessage?: string | null;
  schemaName: string;
  schema: z.ZodType<T>;
  validationRules: string[];
  allowedRepairPaths: string[];
  immutablePaths: string[];
};
```

**Work:**

1. Implement `runSharedJsonSchemaGate(input)`.
2. Normalize AI SDK structured-output errors whose message indicates the provider failed to generate a parsable schema-conforming object into `object_generation_unparseable`.
3. Preserve raw text, partial text, response text, or provider payload text when present.
4. Treat `object_generation_unparseable` with usable text like `finishReason=length`.
5. Treat `object_generation_unparseable` with no usable text like empty `finishReason=length`.
6. Implement deterministic JSON scanner/stack state for truncation classification. Do not use regex to decide suffixes.
7. Classify truncation as:
   - `tail_closable`
   - `continuation_needed`
   - `prefix_too_broken`
8. For `tail_closable`, generate candidate suffixes only from scanner state:
   - close open string when safe;
   - close open arrays/objects by reversing the bracket stack;
   - never add field names, values, commas, or guessed semantic content.
9. Accept deterministic closure only after `JSON.parse` and Zod validation pass, or after it yields parseable JSON with allowed field-patch errors.
10. For `continuation_needed`, call shared finish repair with schema name, validation rules, likely open path, remaining required paths, previous output, and optional prefilled next character.
11. Reject finish repair that rewrites completed prefix fields.
12. Salvage repeated-prefix or whole-object repair responses only if completed prefix fields are preserved.
13. After extraction/parsing, strip extra object keys before schema validation.
14. Before validation, truncate overlong arrays to their schema-owned max length by keeping the first allowed items.
15. If finished JSON parses but fails schema validation on missing or invalid allowlisted paths, run field-patch repair.
16. Implement field patch as path allowlisted merge plus full Zod validation.
17. Reject unknown field-patch paths even though generated output extra keys are stripped.
18. Emit compact debug metadata for every attempt without leaking full raw output outside existing debug surfaces.

**Verification:**

```bash
npx vitest run src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/prompt-runtime/json-parse-utils.test.ts
```

## Task 5: Wire Shared Schema Gate Into Persona Generation

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/app/api/admin/ai/persona-generation/preview/route.test.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`

**Work:**

1. Create a Persona Core v2 schema-gate adapter that supplies:
   - `PersonaCoreV2Schema`
   - validation rules
   - allowed repair paths
   - immutable paths such as `schema_version`
2. Route one-stage Persona Core v2 generation output through `runSharedJsonSchemaGate()`.
3. Add tests for missing nested Persona Core v2 fields repaired through field patch.
4. Add tests for `finishReason=length` persona generation output using finish continuation before field patch.
5. Add tests for structured-output object generation failure routed like `finishReason=length`.
6. Add tests that extra Persona generation output keys are stripped and do not fail the schema gate.
7. Add tests that overlong Persona reference arrays keep the first allowed items.
8. Ensure preview/save logic only sees typed valid `PersonaCoreV2`.
9. Ensure schema failure stops before quality/semantic audit or persistence.

**Verification:**

```bash
npx vitest run src/app/api/admin/ai/persona-generation/preview/route.test.ts src/lib/ai/admin/persona-generation-contract.test.ts
```

## Task 6: Replace Prompt-Family Static Constants And Guards

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Optional create: `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

**Work:**

1. Implement explicit static main constants for all 8 flow/contentMode combinations:
   - `post_plan` discussion/story
   - `post_body` discussion/story
   - `comment` discussion/story
   - `reply` discussion/story
   - Use the exact constant names and exact text from `plans/persona-v2/2026-05-07-persona-core-v2-prompt-examples-deepseek-handoff-plan.md` sections `Static Constant Inventory`, `Exact Static Main Generation Block Text`, `Exact Static Audit Context Text`, and `Exact Static Quality Repair Context Text`.
   - Do not paraphrase these constants during implementation.
2. Keep dynamic values in named dynamic blocks:
   - policy document
   - persona runtime packet
   - board context
   - target context
   - selected plan
   - root post/source comment/ancestors/recent context
   - generated output
   - failed output
3. Keep `output_format` short and static. It may mention the code-owned schema by purpose, but must not enumerate full key/type JSON.
4. Implement audit contexts split by flow and contentMode.
5. Ensure every audit context has two quality checks only:
   - one flow/content quality check
   - `persona_fit`
6. Implement quality-repair contexts split by flow and contentMode.
7. Ensure quality repair only repairs failed audit aspects and reuses the matching main output schema.
8. Add hardcoding guard tests with sentinel fixture strings:
   - `TEST_ONLY_POLICY_SENTINEL`
   - `TEST_ONLY_PERSONA_SENTINEL`
   - `TEST_ONLY_BOARD_SENTINEL`
   - `TEST_ONLY_TARGET_SENTINEL`
   - `TEST_ONLY_GENERATED_OUTPUT_SENTINEL`
   - `TEST_ONLY_FAILED_OUTPUT_SENTINEL`
9. Add tests that production prompt files do not import from fixtures and do not contain example-only text from the handoff plan.
10. Remove standalone per-flow `schema_repair` prompt templates; schema repair goes through the shared repair framework.
11. Add a "Prompt Rule Ambiguity" docs section:
    - If rule ownership is unclear, ask the user.
    - Do not hardcode a guessed policy into production prompts.
    - Do not add DeepSeek-specific branches without approval.
12. Verify the ambiguity rule appears in `docs/ai-agent/llm-flows/prompt-family-architecture.md` or the current canonical prompt-family architecture doc.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts
rg -n "Prompt Rule Ambiguity|ask the user|Do not hardcode|DeepSeek-specific branches" docs/ai-agent/llm-flows plans/persona-v2
```

## Task 7: Wire Prompt-Family Flows Through Structured Output And Schema Gate

**Files:**

- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.ts`
- Modify: `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/flows/single-stage-writer-flow.ts`
- Modify or inspect matching comment/reply flow tests:
  - `src/lib/ai/agent/execution/flows/comment-flow-module.test.ts`
  - `src/lib/ai/agent/execution/flows/reply-flow-module.test.ts`
- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify: `src/lib/ai/agent/execution/persona-task-generator.ts`

**Work:**

1. For every main JSON output, call AI SDK structured output with the correct Zod schema where provider support allows it.
2. On successful structured output, treat the returned object as the primary typed value and run any lightweight normalization/debug validation required by the shared gate.
3. On structured-output failure with usable raw/partial text, route that text through the shared gate as a length-equivalent repair candidate.
4. On structured-output failure without usable raw/partial text, return the typed empty-length diagnostic or an explicitly allowed compact retry.
5. Call audit only with schema-valid typed objects.
6. If schema gate fails, return typed schema failure and do not audit.
7. After quality repair, pass repaired raw output through the same schema gate before re-audit.
8. Ensure existing debug surfaces show schema gate attempts compactly.
9. Preserve existing app-owned ranking/selection logic, but feed it typed valid outputs only.

**Verification:**

```bash
npx vitest run src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
```

## Task 8: Keep Audit Quality-Only

**Files:**

- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/post-plan-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/post-body-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/comment-flow-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
- Modify: `src/lib/ai/prompt-runtime/reply-flow-audit.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-audit-shared.ts`

**Work:**

1. Remove generated-output schema validation responsibilities from audit prompt constants.
2. Keep audit output schemas code-owned and structured.
3. Ensure audit prompt text does not mention checking:
   - JSON parseability
   - required keys
   - field types
   - candidate count
   - metadata shape
   - `metadata.probability` presence/range
   - extra keys
   - array length overflow
4. Keep markdown quality checks as publishability/content quality, not type validation.
5. Keep story-mode narrative fit folded into the one story quality check.
6. Add tests that fail if audit constants include schema-stage language.

**Verification:**

```bash
npx vitest run src/lib/ai/prompt-runtime/post-plan-audit.test.ts src/lib/ai/prompt-runtime/post-body-audit.test.ts src/lib/ai/prompt-runtime/comment-flow-audit.test.ts src/lib/ai/prompt-runtime/reply-flow-audit.test.ts
```

## Task 9: Migrate Other JSON-Producing Flows After Persona v2 Works

**Files:**

- Inspect and modify as needed:
  - `src/lib/ai/agent/intake/intake-stage-llm-service.ts`
  - `src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`
  - `src/lib/ai/admin/llm-flow-shared.ts`
  - any `src/lib/ai/**` call site found by the verification grep below.

**Work:**

1. Inventory every LLM call that expects JSON.
2. For each JSON output, define a code-owned Zod schema or reuse an existing one.
3. Supply schema name, validation rules, allowed repair paths, and immutable paths.
4. Route model output through `runSharedJsonSchemaGate()` before app-owned consumption.
5. Do not migrate non-JSON text outputs into the schema gate.
6. Keep intake scoring and selector semantic checks separate from schema repair.

**Verification:**

```bash
rg -n "JSON.parse|safeJson|parse.*Json|finishReason|schema_repair|quality_repair" src/lib/ai
npx vitest run src/lib/ai/agent/intake/intake-stage-llm-service.test.ts src/lib/ai/json-repair/schema-gate.test.ts
```

## Task 10: Full Verification And Contract Greps

**Files:**

- No new implementation files unless failures reveal missed call sites.

**Work:**

1. Run focused Persona Core v2 tests.
2. Run focused prompt-family tests.
3. Run flow tests.
4. Run intake tests if any intake JSON path was migrated.
5. Run typecheck.
6. Run guard greps for retired or forbidden contracts.

**Verification:**

```bash
npx vitest run src/lib/ai/core/persona-core-v2.test.ts src/lib/ai/admin/persona-generation-prompt-template.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts src/lib/ai/json-repair/schema-gate.test.ts src/lib/ai/agent/execution/flows/post-flow-module.test.ts src/lib/ai/agent/execution/flows/comment-flow-module.test.ts src/lib/ai/agent/execution/flows/reply-flow-module.test.ts
npm run typecheck
rg -n "do_not_imitate|\\[memory\\]|relationship_context|default examples|generateObject|streamObject|STATIC_OUTPUT_CONTRACT|\\[output_contract\\]|FULL_SCHEMA_TEXT|schemaText" src/lib/ai src/app/api/admin/ai/persona-generation
rg -n "assertExactKeys|exact keys|extra keys.*invalid|candidate count|metadata\\.probability.*audit" src/lib/ai src/app/api/admin/ai/persona-generation
```

Expected:

- Focused Vitest suites pass.
- Typecheck passes.
- Persona generation prompt uses exactly the eight compact blocks.
- Prompt-family output blocks contain short output policy only.
- JSON shape comes from code-owned Zod schemas through AI SDK structured output.
- Schema gate runs before every audit.
- Audit never sees unparseable or schema-invalid generated output.
- Extra model-output keys are stripped, not treated as schema failure.
- Overlong arrays keep the first allowed items, not schema failure.
- Length-like truncation uses finish continuation before field patch.

## Staff-Engineer Review Checklist

- [ ] `PersonaCoreV2Schema` is the canonical Persona Core v2 schema.
- [ ] Persona generation is one stage and returns one compact `PersonaCoreV2`.
- [ ] Persona generation prompt has exactly `task`, `input`, `reference_rules`, `persona_rules`, `fit_probability`, `compactness`, `internal_design_process`, `output_validation`.
- [ ] `reference_style.do_not_imitate` is deleted from v2 data.
- [ ] Non-imitation remains enforced by prompt/validation.
- [ ] `persona_fit_probability` is an integer from 0 to 100.
- [ ] `reference_style.reference_names` has 1 to 5 items.
- [ ] `reference_style.other_references` has 0 to 8 items.
- [ ] Overlong `reference_style.reference_names` and `reference_style.other_references` are truncated to the first allowed items.
- [ ] Prompt-family main constants cover all 8 flow/contentMode combinations.
- [ ] Audit constants cover all 8 flow/contentMode combinations and have at most two quality checks.
- [ ] Quality repair constants cover all 8 flow/contentMode combinations.
- [ ] No production prompt contains full hardcoded key/type JSON schema text.
- [ ] Main, audit, and quality-repair JSON use code-owned Zod schemas.
- [ ] Generated-output schemas strip extra keys and do not use `assertExactKeys`.
- [ ] Overlong generated-output arrays are normalized to the first allowed items.
- [ ] `metadata.probability` is AI self-rating metadata and is never audited.
- [ ] Shared schema gate is outside Persona-specific code.
- [ ] Persona v2 adapters provide schemas and path metadata to the shared gate.
- [ ] `tail_closable` repair uses scanner/stack state, not regex.
- [ ] `finishReason=length` and normalized AI SDK object-generation failures use finish continuation before field patch.
- [ ] Empty length-like output returns typed diagnostic or explicit compact retry, not audit.
- [ ] Field patches are path allowlisted and preserve immutable completed fields.
- [ ] Quality audit is quality-only and never validates generated-output schema.
- [ ] Debug metadata explains repair attempts without leaking unnecessary full prompts.

## Handoff Summary For DeepSeek

Implement this as a contract migration, not as prompt copy-paste. First make schemas and PersonaCoreV2 strict, then add the shared schema gate, then wire persona generation, then wire prompt-family constants and audits, then migrate remaining JSON call sites. The goal is a smaller prompt surface with stronger code-owned structure: short behavioral prompts, Zod schemas, bounded repair, and quality-only audits.
