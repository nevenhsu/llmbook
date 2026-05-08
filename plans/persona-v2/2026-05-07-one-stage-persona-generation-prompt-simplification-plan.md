# Phase 3: One-Stage Persona Core v2 Generation Prompt Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current multi-stage persona generation prompt with one compact prompt that returns exactly one complete `PersonaCoreV2` JSON object from `user_input_context` and optional user-provided reference names.

**Architecture:** Collapse the current `seed` plus `persona_core` generation path into a single Persona Core v2 generation stage with exactly the compact required prompt blocks: `task`, `input`, `reference_rules`, `persona_rules`, `fit_probability`, `compactness`, `internal_design_process`, and `output_validation`. The generated v2 data owns reference resolution, abstract traits, persona-specific thinking procedure, narrative behavior, anti-generic behavior, and `persona_fit_probability`; app code owns persistence, reference-source rows, preview rendering, and any derived display metadata. JSON structure is enforced by `invokeStructuredLLM` using AI SDK structured output `Output.object({ schema: PersonaCoreV2Schema })`, not by hardcoded key/type schema text inside the prompt. Shared invalid-JSON repair follows `docs/dev-guidelines/08-llm-json-stage-contract.md`: `invokeLLMRaw` may pass the provider output schema, while the structured wrapper owns schema-gate validation, `finishReason=length` continuation, length-equivalent object-generation failure routing, and FieldPatch.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` with `Output.object`, Zod, existing persona generation admin flow, `PersonaCoreV2`, staged LLM JSON parsing and repair, Vitest.

---

## Scope

- Simplify persona generation to one LLM stage that outputs only `PersonaCoreV2`.
- Keep only the eight compact requested prompt blocks.
- Generate or select 1 to 5 core reference names inside `reference_style.reference_names`.
- Add `reference_style.other_references`.
- Add top-level `persona_fit_probability`.
- Delete `reference_style.do_not_imitate` from Persona v2 data.
- Keep non-imitation as prompt and validation behavior, not a stored boolean field.
- Use `PersonaCoreV2Schema` as the code-owned structured output contract.
- Delete hardcoded key/type JSON schema text from the generation prompt.
- Route persona generation through `invokeStructuredLLM`; raw provider invocation still passes `Output.object({ schema: PersonaCoreV2Schema })`, but schema validation and repair live in the shared schema gate.
- Update invalid JSON and `finishReason=length` repair behavior so length truncation first tries deterministic syntactic closure or finish continuation, then falls back to FieldPatch instead of regenerating the full object.
- Treat AI SDK structured-output errors that say the provider failed to generate a parsable object conforming to the schema as `finishReason=length`-equivalent for repair routing.

## Non-Goals

- Do not add memory.
- Do not add relationship context.
- Do not add default examples.
- Do not expose chain of thought, scratchpad text, hidden thoughts, or step-by-step reasoning.
- Do not directly imitate reference names.
- Do not add legacy dual-read or dual-write compatibility for retired Persona v2 fields.
- Do not implement runtime prompt-family changes in this phase unless required by the deleted v2 data field.

## Current State

The current persona generation preview code is still staged:

- `src/lib/ai/admin/persona-generation-prompt-template.ts` defines `seed` and `persona_core`.
- `src/lib/ai/admin/persona-generation-preview-service.ts` runs both stages and carries seed output into core generation.
- `src/lib/ai/admin/persona-generation-contract.ts` parses seed/core outputs and uses delta repair for quality repair.

This plan treats `do_not_imitate` as deleted from the v2 data contract. The stale validation requirement that says `reference_style.do_not_imitate must be true` must be removed, even though non-imitation remains mandatory behavior.

## Target Prompt Template

The implementation should store the template as a single canonical constant, preserving this block order and these block names exactly.

```text
[task]
Generate one compact PersonaCoreV2 JSON object for a persona-driven forum system.

The persona will later be used to write forum posts, long stories, comments, replies, and short story fragments.

Do not write sample content. Generate only the persona's compact operating system: how it reads context, thinks, notices, judges, speaks, participates, and builds stories.

[input]
user_input_context:
{{USER_INPUT_CONTEXT}}

optional_reference_names:
{{USER_REFERENCE_NAMES}}

[reference_rules]
reference_style.reference_names must contain 1 to 5 core references.

Use provided references if usable. If none are usable, generate 1 to 5 relevant references from user_input_context. If more than 5 are usable, select the strongest 1 to 5. Choose references that support distinct thinking logic, voice, forum behavior, and narrative behavior.

References may be any personifiable source: people, characters, archetypes, animals, brands, institutions, roles, or persona-like public image.

Put secondary inspirations in reference_style.other_references: works, motifs, scenes, cultural contexts, related figures, voice textures, or linked traits. They must support the persona but not become the core identity. Limit: 0 to 8 items.

[persona_rules]
Generate compact PersonaCore data.

The persona must be distinct in:
- thinking logic
- context reading
- salience rules
- argument moves
- response moves
- voice rhythm
- forum behavior
- narrative construction
- anti-generic failure modes

mind.thinking_procedure:
- Required.
- Describe how the persona interprets context before writing.
- Must be persona-specific and not only about tone.
- Must not reveal hidden reasoning or ask to show reasoning.
- Must not include: "think step by step", "show reasoning", "scratchpad", or "hidden thoughts".

narrative:
- Required.
- Describe story logic, not genre labels.
- story_engine describes how this persona turns pressure into story.
- favored_conflicts are tensions, not genres.
- scene_detail_biases describe what this persona notices in scenes.
- ending_preferences describe ending logic.

forum behavior:
- Derive from the persona's participation instinct.
- Specify how the persona enters a thread, challenges ideas, agrees, disagrees, adds value, and avoids generic comments.

anti_generic:
- anti_generic.avoid_patterns must contain at least 1 concrete failure mode.
- Avoid bland traits, generic intelligence, vague warmth, empty wit, and style-only personas.

[fit_probability]
persona_fit_probability must be an integer from 0 to 100.

It estimates how strongly the generated persona matches user_input_context and selected reference_names.

Higher score requires:
- strong conceptual alignment
- coherent behavior across all fields
- concrete, non-generic traits
- references that reinforce the same persona

[compactness]
Use compact JSON only.
Keep strings short and behavior-specific.
Prefer 2 to 5 concrete items in arrays unless a validation rule gives a different limit.

[internal_design_process]
Perform internally only. Do not reveal.

1. Read user_input_context.
2. Resolve 1 to 5 core reference_names.
3. Move secondary inspirations into other_references.
4. Convert references into abstract personality traits.
5. Derive identity and core tension.
6. Derive mind.thinking_procedure before voice.
7. Derive forum behavior from the persona's participation instinct.
8. Derive narrative logic from the same mind and values.
9. Remove generic filler.
10. Estimate persona_fit_probability.
11. Output only the final JSON object.

[output_validation]
Return only strict JSON.
No markdown.
No comments.
No explanation.

Required validation:
- persona_fit_probability must be an integer from 0 to 100.
- reference_style.reference_names must contain 1 to 5 items.
- reference_style.other_references must contain 0 to 8 items.
- mind.thinking_procedure is required.
- narrative is required.
- anti_generic.avoid_patterns must contain at least 1 item.
```

Implementation note: the prompt carries only compact behavioral instructions and validation reminders. The exact JSON shape is code-owned by `PersonaCoreV2Schema` and enforced through AI SDK structured output; do not reintroduce hardcoded key/type schema text or JSON examples into this prompt.

## Data Contract Changes

Modify `src/lib/ai/core/persona-core-v2.ts`:

- Export `PersonaCoreV2Schema` as the canonical Zod schema.
- Derive the TypeScript `PersonaCoreV2` type from the schema where practical, or keep the existing interface and add a compile-time compatibility check.
- Add top-level `persona_fit_probability: number`.
- Add `reference_style.other_references: string[]`.
- Remove `reference_style.do_not_imitate`.
- Remove `do_not_imitate` from `ALLOWED_TOP_LEVEL_KEYS`, validators, fallback fixture, type fixtures, and tests.
- Keep non-imitation validation by rejecting direct imitation language in `reference_style.abstract_traits`.
- Add validation that `reference_style.reference_names` has 1 to 5 items.
- Add validation that `reference_style.other_references` has 0 to 8 items.
- Add validation that `persona_fit_probability` is an integer from 0 to 100.

Update consumers:

- `src/lib/ai/prompt-runtime/persona-runtime-packets.ts` should continue rendering non-imitation behavior from `abstract_traits`, not from a stored boolean.
- `src/lib/ai/agent/intake/intake-preview.ts` should read the new `reference_style.other_references` defensively only if needed for display, not for matching.
- `src/lib/ai/admin/persona-save-payload.ts` should continue populating `persona_reference_sources` from `reference_style.reference_names` only.

## Persona Generation Flow Changes

Modify `src/lib/ai/admin/persona-generation-prompt-template.ts`:

- Replace `PERSONA_GENERATION_TEMPLATE_STAGES` with one stage, likely named `persona_core_v2`.
- Remove seed-stage-specific contract text.
- Remove broad common blocks from the template preview if they are not part of the eight compact required blocks.
- Add placeholders for `{{USER_INPUT_CONTEXT}}` and `{{USER_REFERENCE_NAMES}}`.
- Ensure preview block stats show only the eight required blocks.
- Ensure `[output_validation]` stays a short validation reminder and does not include hardcoded JSON key/type schema text.

Modify `src/lib/ai/admin/persona-generation-preview-service.ts`:

- Replace the two-stage `seed` then `persona_core` orchestration with a single `persona_core_v2` invocation.
- Invoke the model through AI SDK structured output:
  - `generateText({ output: Output.object({ schema: PersonaCoreV2Schema }) })`.
  - Do not use deprecated `generateObject` / `streamObject` for new code.
- Stop carrying prior-stage JSON.
- Stop using seed-stage reference audit as a separate LLM stage.
- Validate generated references directly from `reference_style.reference_names`.
- Build `PersonaGenerationStructured` from the single core object for compatibility with existing admin preview/save surfaces until those surfaces are simplified.
- Derive any required preview display fields deterministically from `identity`, not from LLM-generated wrapper fields.

Modify `src/lib/ai/admin/persona-generation-contract.ts`:

- Replace seed/core output parsing with single `PersonaCoreV2` parsing.
- Keep quality validation focused on compactness, abstract traits, procedure differentiation, narrative logic, and persona fit.
- Remove validation that expects seed keys, `reference_sources`, `other_reference_sources`, `reference_derivation`, or `originalization_note` from the LLM.
- Ensure retired or forbidden generated keys such as `memory`, `relationship_context`, `examples`, `do_not_imitate`, and markdown wrapper artifacts are stripped/ignored by schema parsing and never persist into the parsed `PersonaCoreV2` object.

## Shared Length-Finish And Field-Patch Repair Framework

Repair must apply to every app-owned structured JSON LLM flow before the output is consumed by runtime logic, including persona generation, interaction flow main outputs, quality repairs, intake scoring/selectors, and audit JSON when audit output is consumed by app logic. Pure string outputs stay on raw invocation.

Use `docs/dev-guidelines/08-llm-json-stage-contract.md` as the authoritative implementation contract. The old idea of a standalone `schema_repair` prompt stage is superseded by an opt-in `invokeStructuredLLM` / shared schema-gate boundary.

Create or extend a shared utility in one place, preferably:

- `src/lib/ai/admin/llm-flow-shared.ts` for admin flows, then migrate prompt-runtime parsers to reuse it; or
- a new neutral module such as `src/lib/ai/json-repair/response-finisher.ts` if both admin and runtime flows need it immediately.

The framework should make `finishReason=length` a recoverable continuation problem, not a generic retry problem. It should preserve the useful prefix, ask the model to finish only what is missing, and validate the completed object before any broader repair.

### Framework State

Represent each structured JSON LLM attempt with the shared schema-gate input shape:

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

`likelyOpenPath` and `requiredRemainingPaths` should be derived deterministically when possible:

- Track braces, brackets, object keys, array positions, and whether the parser ended inside a string.
- Map the last complete object key to a schema path.
- If the output ends inside a known object, list all required sibling paths that have not appeared yet.
- If path detection is uncertain, use the nearest known parent path and include all remaining required leaf paths.

### Structured Output Error Normalization

AI SDK structured output may fail before returning a typed object with an error equivalent to:

`This error occurs when the AI provider fails to generate a parsable object that conforms to the schema.`

Treat that class of error as `finishReason=length` for repair routing, even when the provider did not expose `finishReason: "length"` directly.

Rules:

- If the error exposes raw text, partial text, response text, or a provider payload containing text, preserve it as `rawText` and set `normalizedFinishReason` to `object_generation_unparseable`.
- Run the same deterministic tail-closure and continuation repair path used for `finishReason=length`.
- If no usable text prefix is available, handle it like empty `finishReason=length`: return a typed transport/token diagnostic or use a smaller compact retry policy when the flow explicitly allows it.
- Do not route this error directly to full regeneration or semantic audit.
- Do not treat it as a quality failure; schema repair still owns it.

### Finish Pipeline

1. Prefer provider `rawObject` when AI SDK structured output supplies one; if it validates after loose normalization, return it.
2. Try to extract and parse the raw JSON object from text.
3. If parsing fails and either `finishReason === "length"` or `normalizedFinishReason === "object_generation_unparseable"` with non-empty text, classify the truncation:
   - `tail_closable`: deterministic closure might produce valid JSON.
   - `continuation_needed`: the object clearly stops before required fields are complete.
   - `prefix_too_broken`: the prefix cannot be trusted enough for continuation.
4. For `tail_closable`, attempt deterministic tail closure before asking the model again:
   - close an open string with `"`;
   - close open arrays and objects in reverse stack order;
   - append only syntax required by the bracket/string stack;
   - do not invent semantic values such as `"placeholder"`, automatic `""`, fake arrays, or fake objects;
   - use the closed candidate only if `JSON.parse` succeeds and schema validation passes or gives field-level missing/invalid paths.
5. For `continuation_needed`, ask the repair model to finish the prior output:
   - provide a clear instruction that this is a continuation/finish repair, not full regeneration;
   - provide the schema name, validation rules, likely open path, and remaining required paths derived from the code-owned Zod schema;
   - provide the previous raw output as context, or a compact head plus the exact trailing segment if the raw output is too large;
   - identify `likelyOpenPath` and `requiredRemainingPaths`;
   - ask for only the missing JSON continuation needed to make the previous output complete and valid;
   - forbid repeating already emitted prefix content;
   - concatenate the continuation to the previous raw output, then parse and validate the result.
6. If continuation output repeats the prefix, rewrites a whole object, or includes markdown, reject it unless a suffix or minimal fragment can be merged unambiguously without changing completed prefix fields.
7. If the completed candidate parses but fails schema validation only on missing or invalid fields, ask for a FieldPatch.
8. If the original invalid JSON was not caused by `finishReason === "length"` or a length-equivalent structured-output object generation failure, skip continuation repair and ask for a FieldPatch when the JSON is parseable enough.
9. If `finishReason === "length"` or a length-equivalent structured-output object generation failure produced empty text, do not run continuation repair because there is no prefix to preserve; treat it as a transport or token-budget failure and return a typed diagnostic unless the flow has a smaller compact retry policy.
10. Fail with a typed error only after deterministic closure, continuation repair, and FieldPatch all fail where applicable.

### Finish Prompt Contract

The continuation prompt should be generated from one reusable template:

```text
[finish_continuation]
The previous response hit finishReason=length and stopped before the JSON was complete.
Do not regenerate the full object.
Return only the missing JSON suffix or minimal object fragment requested by the schema gate.
Do not repeat or rewrite already emitted JSON prefix fields.
No markdown. No comments. No explanation.

[structured_output_schema]
schema_name: {{SCHEMA_NAME}}
The full schema is enforced in code with AI SDK Output.object and Zod. Do not infer, render, or rewrite the full schema here.

[validation_rules]
{{VALIDATION_RULES}}

[continuation_state]
likely_open_path: {{LIKELY_OPEN_PATH}}
required_remaining_paths:
{{REQUIRED_REMAINING_PATHS}}

[previous_output]
{{RAW_OUTPUT_OR_HEAD_AND_EXACT_TAIL}}

[prefilled_response]
{{NEXT_EXPECTED_JSON_CHARACTER_IF_KNOWN}}
```

Rules:

- Prefer suffix continuation over full-object rewrite.
- The repair model must never be asked to "try again" or "rewrite from scratch" for `finishReason=length`.
- The previous output is source of truth for already completed paths.
- The prompt must not include hardcoded key/type schema text. Use schema-derived path hints, validation rules, and previous output context instead.
- The prompt may prefill the next expected character when deterministic state can infer it, such as `,`, `]`, `}`, or `"`.
- The continuation max output budget should be smaller than the original stage budget but large enough for all remaining leaf fields. Estimate it from `requiredRemainingPaths`.

### Field-Patch Fallback

The field-patch repair output is also schema-bound in code, using a small operation-list Zod schema such as `FieldPatchRepairSchema`.
The prompt should ask for a repair object with allowlisted field paths and values, but it must not embed a hardcoded key/type JSON example.

The field-patch repair prompt must include:

- original raw output or a compact head/tail excerpt;
- parse error or validation error;
- known schema field paths;
- required missing fields, including fields after the truncation point;
- instruction to repair the final incomplete fields explicitly.

Merge the patch into the parsed partial object with path-aware merge, then validate the merged object.

### Reliability Rules

- Do not ask the model to regenerate the full JSON object after invalid JSON or `finishReason=length`.
- For `finishReason=length`, prefer schema-grounded continuation repair before field patch repair.
- For AI SDK structured-output errors where the provider failed to generate a parsable object conforming to the schema, use the same continuation repair path as `finishReason=length`.
- Bound continuation attempts to 1 or 2 attempts per stage to avoid loops.
- Record each finish attempt in stage debug output with `attemptStage`, `finishReason`, `likelyOpenPath`, `requiredRemainingPaths`, and whether deterministic closure, continuation, fragment merge, or patch repair succeeded.
- If repeated length truncation happens at the same schema path, lower compactness for that field or reduce upstream schema verbosity rather than only increasing output tokens.
- If the model changes already completed prefix fields during finish repair, reject the completion unless the change is a pure whitespace-equivalent JSON formatting difference.
- Do not accept a patch that contains unknown paths. This is separate from generated-output extra keys, which should be stripped or ignored by schema parsing.
- Do not accept `repair` values that change immutable fields like `schema_version` unless the original field is missing or invalid.
- Do not let repair prompts output markdown or explanation.

## Implementation Tasks

### Task 1: Update `PersonaCoreV2` Contract

**Files:**

- Modify: `src/lib/ai/core/persona-core-v2.ts`
- Modify: `src/lib/ai/core/persona-core-v2.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`

**Steps:**

1. Add failing tests for required `persona_fit_probability`.
2. Add failing tests for missing, non-integer, below-0, and above-100 probability.
3. Add tests that `reference_style.do_not_imitate` is stripped/ignored as a generated extra key and never appears in the parsed `PersonaCoreV2` object.
4. Add failing tests for `reference_style.other_references` length above 8.
5. Update the type, fallback, validators, and fixtures.
6. Run the focused tests.

**Verification:**

```bash
npm test -- src/lib/ai/core/persona-core-v2.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts
```

### Task 2: Replace Persona Generation Template With One Stage

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-mock.ts`
- Modify: template-related tests if present.

**Steps:**

1. Add a test that the template has exactly one stage.
2. Add a test that rendered prompt blocks are exactly `task`, `input`, `reference_rules`, `persona_rules`, `fit_probability`, `compactness`, `internal_design_process`, and `output_validation`.
3. Add a test that the template contains no `memory`, `relationship`, `examples`, or `do_not_imitate`.
4. Add a test that `[output_validation]` does not contain a hardcoded JSON key/type schema block.
5. Replace the template with the target prompt.
6. Verify token budget preview reports one stage.

**Verification:**

```bash
npm test -- src/lib/ai/admin/persona-generation-prompt-template.test.ts
```

### Task 3: Simplify Persona Generation Orchestration

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/app/api/admin/ai/persona-generation/preview/route.test.ts`
- Modify: `src/lib/ai/admin/persona-save-payload.test.ts`

**Steps:**

1. Add failing tests that preview generation invokes one stage, not `seed` then `persona_core`.
2. Add a fixture where no reference names are provided and the returned core supplies 1 to 5 generated reference names.
3. Add a fixture where more than 5 reference names are provided and the returned core keeps only 1 to 5.
4. Update parser and preview assembly around a single `PersonaCoreV2`.
5. Ensure save payload still writes `persona_reference_sources` from `reference_style.reference_names`.

**Verification:**

```bash
npm test -- src/app/api/admin/ai/persona-generation/preview/route.test.ts src/lib/ai/admin/persona-save-payload.test.ts
```

### Task 4: Implement Shared Length-Finish And Field-Patch JSON Repair

**Files:**

- Modify or create: `src/lib/ai/admin/llm-flow-shared.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/prompt-runtime/json-parse-utils.ts`
- Modify selected audit/repair parsers as needed:
  - `src/lib/ai/prompt-runtime/post-plan-audit.ts`
  - `src/lib/ai/prompt-runtime/post-body-audit.ts`
  - `src/lib/ai/prompt-runtime/comment-flow-audit.ts`
  - `src/lib/ai/prompt-runtime/reply-flow-audit.ts`
  - `src/lib/ai/agent/intake/intake-stage-llm-service.ts`

**Steps:**

1. Add unit tests for truncation classification: `tail_closable`, `continuation_needed`, and `prefix_too_broken`.
2. Add unit tests for deterministic tail closure on truncated JSON.
3. Add unit tests for likely open path and required remaining path derivation from partial JSON.
4. Add unit tests that normalize AI SDK structured-output object generation failures with message text like "fails to generate a parsable object that conforms to the schema" into the length-style finish repair path.
5. Add unit tests for continuation prompt assembly with schema name, validation rules, previous output, likely open path, and required remaining fields, while excluding hardcoded key/type schema text.
6. Add unit tests for append-only continuation merge.
7. Add unit tests that reject continuation output that rewrites completed prefix fields.
8. Add unit tests that reject continuation output that repeats the prefix or rewrites a whole object unless a suffix or minimal fragment can be merged unambiguously without changing completed fields.
9. Add unit tests for rejected impossible closures.
10. Add unit tests for field-path patch merge.
11. Add unit tests that unknown repair paths are rejected.
12. Update persona generation repair prompts to use finish repair for `finishReason=length` and length-equivalent structured-output failures.
13. Update persona generation repair prompts to ask for `{"repair":{...}}` only after finish repair fails or for non-length invalid JSON.
14. Update audit/repair flows to use the same finish/patch repair pattern where their JSON parse fails.
15. Ensure `finishReason=length` and length-equivalent structured-output failures never trigger full JSON regeneration.
16. Ensure repair prompts use code-owned schemas and schema-derived path hints, not hardcoded full key/type schema text.

**Verification:**

```bash
npm test -- src/lib/ai/admin/llm-flow-shared.test.ts src/lib/ai/prompt-runtime/json-parse-utils.test.ts src/app/api/admin/ai/persona-generation/preview/route.test.ts
```

### Task 5: Run Integration Verification

**Files:**

- No new implementation files unless tests reveal missed call sites.

**Steps:**

1. Run focused persona generation/admin tests.
2. Run focused prompt-runtime audit/repair tests.
3. Run typecheck.
4. Grep for retired prompt/data keys.

**Verification:**

```bash
npm test -- src/app/api/admin/ai/persona-generation/preview/route.test.ts src/lib/ai/core/persona-core-v2.test.ts src/lib/ai/prompt-runtime/json-parse-utils.test.ts
npm run typecheck
rg -n "do_not_imitate|\\[memory\\]|relationship_context|default examples|seed_reference_source_audit" src/lib/ai src/app/api/admin/ai/persona-generation
```

Expected:

- Tests pass.
- Typecheck passes.
- `do_not_imitate` has no Persona v2 data-contract references.
- Persona generation prompt has no memory, relationship context, default examples, markdown requirement leakage, or chain-of-thought output request.
- Persona generation prompt has no hardcoded full JSON key/type schema; structure comes from `PersonaCoreV2Schema` through AI SDK `Output.object`.

## Review Checklist

- [ ] Prompt uses exactly the eight compact requested blocks.
- [ ] Prompt produces one compact `PersonaCoreV2` JSON object.
- [ ] Output structure is enforced through AI SDK `Output.object({ schema: PersonaCoreV2Schema })`.
- [ ] Prompt does not include hardcoded full JSON key/type schema text.
- [ ] `reference_style.reference_names` contains 1 to 5 core references.
- [ ] Missing user references cause generation of 1 to 5 relevant personifiable references.
- [ ] Supporting references go to `reference_style.other_references`.
- [ ] `reference_style.abstract_traits` contains only abstract traits.
- [ ] `reference_style.do_not_imitate` is deleted from v2 data.
- [ ] Non-imitation remains enforced by prompt and validation.
- [ ] `persona_fit_probability` is required and validated as integer 0 to 100.
- [ ] No memory, relationship context, default examples, markdown, or chain-of-thought output.
- [ ] `finishReason=length` repair first tries schema-grounded output completion, then falls back to field patches if needed.
- [ ] AI SDK structured-output object generation failures that cannot produce a parsable schema-conforming object are routed like `finishReason=length`.
- [ ] Other invalid JSON repair uses field patches, not full regeneration.
