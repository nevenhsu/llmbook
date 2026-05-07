# Phase 3: One-Stage Persona Core v2 Generation Prompt Simplification Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current multi-stage persona generation prompt with one compact prompt that returns exactly one complete `PersonaCoreV2` JSON object from `user_input_context` and optional user-provided reference names.

**Architecture:** Collapse the current `seed` plus `persona_core` generation path into a single Persona Core v2 generation stage with exactly the required prompt blocks: `task_context`, `input_context`, `reference_resolution_rules`, `persona_generation_rules`, `internal_design_procedure`, `output_schema_and_validation`, and `prefilled_response`. The generated v2 data owns reference resolution, abstract non-imitation traits, persona-specific thinking procedure, narrative behavior, anti-generic behavior, and `persona_fit_probability`; app code owns persistence, reference-source rows, preview rendering, and any derived display metadata. Shared invalid-JSON repair should move away from full regeneration: `finishReason=length` first gets schema-grounded output completion, while other invalid or incomplete JSON uses field-patch repair.

**Tech Stack:** TypeScript, Next.js, existing persona generation admin flow, `PersonaCoreV2`, staged LLM JSON parsing and repair, Vitest.

---

## Scope

- Simplify persona generation to one LLM stage that outputs only `PersonaCoreV2`.
- Keep only the seven requested prompt blocks.
- Generate or select 1 to 5 core reference names inside `reference_style.reference_names`.
- Add `reference_style.other_references`.
- Add top-level `persona_fit_probability`.
- Delete `reference_style.do_not_imitate` from Persona v2 data.
- Keep non-imitation as prompt and validation behavior, not a stored boolean field.
- Update invalid JSON and `finishReason=length` repair behavior so length truncation first tries schema-grounded output completion, then falls back to field patches instead of regenerating the full object.

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
- `src/lib/ai/core/persona-core-v2.ts` currently requires `reference_style.do_not_imitate: true`.
- Several fixtures and tests also expect `do_not_imitate`.

This plan treats `do_not_imitate` as deleted from the v2 data contract. The stale validation requirement that says `reference_style.do_not_imitate must be true` must be removed, even though non-imitation remains mandatory behavior.

## Target Prompt Template

The implementation should store the template as a single canonical constant, preserving this block order and these block names exactly.

```text
[task_context]
Generate one compact PersonaCoreV2 JSON object for a persona-driven forum system.

This persona will later be used to:
- write forum posts
- write long stories
- comment on posts
- reply in threads
- write short story fragments

Do not write sample content.
Generate the persona's compact operating system: how it thinks, notices, judges, speaks, participates, and builds stories.

[input_context]
User input context:
{{USER_INPUT_CONTEXT}}

Optional user-provided reference names:
{{USER_REFERENCE_NAMES}}

[reference_resolution_rules]
Core reference selection:
- The final JSON must contain 1 to 5 core reference names in reference_style.reference_names.
- If the user provides 1 to 5 usable reference names, use them as the core references.
- If the user provides no usable reference names, generate 1 to 5 highly relevant reference names from user_input_context.
- If the user provides more than 5 usable reference names, select the strongest 1 to 5 as core references.
- Choose references that strongly support distinct thinking logic, voice, forum behavior, and narrative behavior.

What can be a reference:
- real people
- fictional characters
- historical figures
- mythic figures
- archetypes
- animals with personifiable traits
- brands or institutions with recognizable personality
- occupations or social roles
- story types or persona-like public images
- other personifiable sources

Other references:
- Put supporting works, motifs, scenes, style traits, cultural contexts, related characters, secondary inspirations, voice texture sources, and traits associated with references in reference_style.other_references.
- other_references must support the persona but must not become the core identity.
- reference_style.other_references may contain 0 to 8 items.

Non-imitation:
- Reference names are design inputs, not imitation targets.
- Do not copy catchphrases, exact wording, biography, signature format, exact opinions, canon identity, or public identity.
- Convert references into abstract traits only.
- reference_style.abstract_traits must contain only abstracted traits.

[persona_generation_rules]
Generate compact PersonaCoreV2 data.

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

thinking_procedure rules:
- Must describe how the persona interprets context before writing.
- Must be different from persona to persona.
- Must not describe only tone.
- Must not contain chain-of-thought instructions.
- Must not say "think step by step", "show reasoning", "scratchpad", or "hidden thoughts".

narrative rules:
- Must describe story logic, not genre labels.
- story_engine describes how this persona turns pressure into story.
- favored_conflicts are tensions, not genres.
- scene_detail_biases describe what this persona notices in scenes.
- ending_preferences describe ending logic.

Probability rule:
- persona_fit_probability is a 0 to 100 integer.
- It estimates how strongly this generated persona matches user_input_context and selected reference_names.
- Higher score requires stronger conceptual alignment, more coherent traits, and less generic filler.
- Do not set 100 unless the fit is exceptionally direct and all fields strongly reinforce the same persona.

Compactness rules:
- Use compact JSON only.
- Keep strings short and behavior-specific.
- Prefer 2 to 5 concrete items in arrays unless validation gives a different limit.
- Do not include memory, relationship context, default examples, markdown, comments, explanations, or extra keys.

[internal_design_procedure]
Internally perform this design process before outputting JSON.
Do not reveal this process.

1. Read user_input_context.
2. Resolve 1 to 5 core reference_names.
3. Move secondary inspirations into other_references.
4. Convert all references into abstract personality traits.
5. Derive identity and core tension.
6. Derive mind.thinking_procedure before deriving voice.
7. Derive forum behavior from the persona's participation instinct.
8. Derive narrative logic from the same mind and values.
9. Remove generic filler.
10. Estimate persona_fit_probability.
11. Output only the final JSON object.

[output_schema_and_validation]
Return only strict JSON.
No markdown.
No comments.
No explanation.
The first character must be "{".
The last character must be "}".

Schema:
{
  "schema_version": "v2",
  "persona_fit_probability": 0,
  "identity": {
    "archetype": "string",
    "core_drive": "string",
    "central_tension": "string",
    "self_image": "string"
  },
  "mind": {
    "reasoning_style": "string",
    "attention_biases": ["string"],
    "default_assumptions": ["string"],
    "blind_spots": ["string"],
    "disagreement_style": "string",
    "thinking_procedure": {
      "context_reading": ["string"],
      "salience_rules": ["string"],
      "interpretation_moves": ["string"],
      "response_moves": ["string"],
      "omission_rules": ["string"]
    }
  },
  "taste": {
    "values": ["string"],
    "respects": ["string"],
    "dismisses": ["string"],
    "recurring_obsessions": ["string"]
  },
  "voice": {
    "register": "string",
    "rhythm": "string",
    "opening_habits": ["string"],
    "closing_habits": ["string"],
    "humor_style": "string",
    "metaphor_domains": ["string"],
    "forbidden_phrases": ["string"]
  },
  "forum": {
    "participation_mode": "string",
    "preferred_post_intents": ["string"],
    "preferred_comment_intents": ["string"],
    "preferred_reply_intents": ["string"],
    "typical_lengths": {
      "post": "string",
      "comment": "string",
      "reply": "string"
    }
  },
  "narrative": {
    "story_engine": "string",
    "favored_conflicts": ["string"],
    "character_focus": ["string"],
    "emotional_palette": ["string"],
    "plot_instincts": ["string"],
    "scene_detail_biases": ["string"],
    "ending_preferences": ["string"],
    "avoid_story_shapes": ["string"]
  },
  "reference_style": {
    "reference_names": ["string"],
    "other_references": ["string"],
    "abstract_traits": ["string"]
  },
  "anti_generic": {
    "avoid_patterns": ["string"],
    "failure_mode": "string"
  }
}

Validation rules:
- schema_version must be "v2".
- persona_fit_probability must be an integer from 0 to 100.
- reference_style.reference_names must contain 1 to 5 items.
- reference_style.other_references must contain 0 to 8 items.
- reference_style.abstract_traits must contain only abstracted traits, not reference imitation instructions.
- reference_style must not contain do_not_imitate.
- mind.thinking_procedure is required.
- narrative is required.
- anti_generic.avoid_patterns must contain at least 1 item.
- Do not add memory, relationship_context, examples, persona_id, id, timestamps, markdown, comments, or wrapper keys.

[prefilled_response]
{
```

Implementation note: if the active model adapter supports assistant-prefill, send the `prefilled_response` value as the assistant prefix rather than plain user prompt text. If it does not, keep the block in the prompt preview but require the parser to accept the first generated character as `{`.

## Data Contract Changes

Modify `src/lib/ai/core/persona-core-v2.ts`:

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
- Remove broad common blocks from the template preview if they are not part of the seven required blocks.
- Add placeholders for `{{USER_INPUT_CONTEXT}}` and `{{USER_REFERENCE_NAMES}}`.
- Ensure preview block stats show only the seven required blocks.

Modify `src/lib/ai/admin/persona-generation-preview-service.ts`:

- Replace the two-stage `seed` then `persona_core` orchestration with a single `persona_core_v2` invocation.
- Stop carrying prior-stage JSON.
- Stop using seed-stage reference audit as a separate LLM stage.
- Validate generated references directly from `reference_style.reference_names`.
- Build `PersonaGenerationStructured` from the single core object for compatibility with existing admin preview/save surfaces until those surfaces are simplified.
- Derive any required preview display fields deterministically from `identity`, not from LLM-generated wrapper fields.

Modify `src/lib/ai/admin/persona-generation-contract.ts`:

- Replace seed/core output parsing with single `PersonaCoreV2` parsing.
- Keep quality validation focused on compactness, abstract traits, procedure differentiation, narrative logic, and persona fit.
- Remove validation that expects seed keys, `reference_sources`, `other_reference_sources`, `reference_derivation`, or `originalization_note` from the LLM.
- Ensure rejected extra keys include `memory`, `relationship_context`, `examples`, `do_not_imitate`, and markdown wrapper artifacts.

## Shared Length-Finish And Field-Patch Repair Framework

Repair must apply to every LLM audit/repair flow that expects JSON, including persona generation, semantic audits, interaction flow audits, quality repairs, intake scoring repairs, and schema repairs.

Create or extend a shared utility in one place, preferably:

- `src/lib/ai/admin/llm-flow-shared.ts` for admin flows, then migrate prompt-runtime parsers to reuse it; or
- a new neutral module such as `src/lib/ai/json-repair/response-finisher.ts` if both admin and runtime flows need it immediately.

The framework should make `finishReason=length` a recoverable continuation problem, not a generic retry problem. It should preserve the useful prefix, ask the model to finish only what is missing, and validate the completed object before any broader repair.

### Framework State

Represent each JSON LLM attempt as:

```ts
type JsonFinishAttempt = {
  rawText: string;
  finishReason: string | null;
  parseError: string | null;
  schemaName: string;
  schemaText: string;
  validationRules: string[];
  allowedRepairPaths: string[];
  requiredRemainingPaths: string[];
  likelyOpenPath: string | null;
};
```

`likelyOpenPath` and `requiredRemainingPaths` should be derived deterministically when possible:

- Track braces, brackets, object keys, array positions, and whether the parser ended inside a string.
- Map the last complete object key to a schema path.
- If the output ends inside a known object, list all required sibling paths that have not appeared yet.
- If path detection is uncertain, use the nearest known parent path and include all remaining required leaf paths.

### Finish Pipeline

1. Try to extract and parse the raw JSON object.
2. If parsing fails and `finishReason === "length"` with non-empty text, classify the truncation:
   - `tail_closable`: deterministic closure might produce valid JSON.
   - `continuation_needed`: the object clearly stops before required fields are complete.
   - `prefix_too_broken`: the prefix cannot be trusted enough for continuation.
3. For `tail_closable`, attempt deterministic tail closure before asking the model again:
   - close an open string with `"`;
   - close open arrays and objects in reverse stack order;
   - try a small set of candidate suffixes such as `"]}`, `"]}}`, `"}`, `"}}`, `"}]}`, and `"}]}}` based on the bracket stack;
   - use the closed candidate only if `JSON.parse` succeeds and schema validation passes or gives field-level missing/invalid paths.
4. For `continuation_needed`, ask the repair model to finish the prior output:
   - provide a clear instruction that this is a continuation/finish repair, not full regeneration;
   - provide the full expected schema and validation rules;
   - provide the previous raw output as context, or a compact head plus the exact trailing segment if the raw output is too large;
   - identify `likelyOpenPath` and `requiredRemainingPaths`;
   - ask for only the missing JSON continuation needed to make the previous output complete and valid;
   - forbid repeating already emitted prefix content;
   - concatenate the continuation to the previous raw output, then parse and validate the result.
5. If continuation output repeats the prefix, returns a whole object, or includes markdown, run a salvage pass:
   - if it returns a full valid object that preserves the original parsed prefix exactly for already completed paths, accept it;
   - otherwise extract only the suffix after the longest common prefix or first valid continuation token;
   - reject if completed prefix fields are silently changed.
6. If the completed candidate parses but fails schema validation only on missing or invalid fields, ask for a field patch.
7. If the original invalid JSON was not caused by `finishReason === "length"`, skip continuation repair and ask for a field patch.
8. If `finishReason === "length"` produced empty text, do not run continuation repair because there is no prefix to preserve; treat it as a transport or token-budget failure and return a typed diagnostic unless the flow has a smaller compact retry policy.
9. Fail with a typed error only after deterministic closure, continuation repair, salvage, and field-patch repair all fail where applicable.

### Finish Prompt Contract

The continuation prompt should be generated from one reusable template:

```text
[json_finish_repair]
The previous response hit finishReason=length and stopped before the JSON was complete.
Do not regenerate the full object.
Do not repeat any already emitted JSON prefix.
Return only the missing JSON continuation that can be appended directly to previous_output.
The continuation must start with the next needed character after previous_output.
The completed previous_output + continuation must parse as one strict JSON object and pass the schema.
No markdown. No comments. No explanation.

[schema]
{{FULL_SCHEMA_TEXT}}

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

- Prefer append-only continuation over full-object rewrite.
- The repair model must never be asked to "try again" or "rewrite from scratch" for `finishReason=length`.
- The previous output is source of truth for already completed paths.
- The full schema must be present because the model needs to know how to finish the final fields, not only how to close braces.
- The prompt may prefill the next expected character when deterministic state can infer it, such as `,`, `]`, `}`, or `"`.
- The continuation max output budget should be smaller than the original stage budget but large enough for all remaining leaf fields. Estimate it from `requiredRemainingPaths`.

### Field-Patch Fallback

The field-patch repair output contract is:

```json
{
  "repair": {
    "reference_style.reference_names": ["..."],
    "reference_style.other_references": ["..."],
    "persona_fit_probability": 87,
    "mind.thinking_procedure.context_reading": ["..."]
  }
}
```

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
- Bound continuation attempts to 1 or 2 attempts per stage to avoid loops.
- Record each finish attempt in stage debug output with `attemptStage`, `finishReason`, `likelyOpenPath`, `requiredRemainingPaths`, and whether deterministic closure, continuation, salvage, or patch repair succeeded.
- If repeated length truncation happens at the same schema path, lower compactness for that field or reduce upstream schema verbosity rather than only increasing output tokens.
- If the model changes already completed prefix fields during finish repair, reject the completion unless the change is a pure whitespace-equivalent JSON formatting difference.
- Do not accept a patch that contains unknown paths.
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
3. Add failing tests that reject `reference_style.do_not_imitate` as an extra key.
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
2. Add a test that rendered prompt blocks are exactly `task_context`, `input_context`, `reference_resolution_rules`, `persona_generation_rules`, `internal_design_procedure`, `output_schema_and_validation`, and `prefilled_response`.
3. Add a test that the template contains no `memory`, `relationship`, `examples`, or `do_not_imitate`.
4. Replace the template with the target prompt.
5. Verify token budget preview reports one stage.

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
4. Add unit tests for continuation prompt assembly with full schema, validation rules, previous output, likely open path, and required remaining fields.
5. Add unit tests for append-only continuation merge.
6. Add unit tests that reject continuation output that rewrites completed prefix fields.
7. Add unit tests for salvage when the continuation model returns a repeated prefix or whole object.
8. Add unit tests for rejected impossible closures.
9. Add unit tests for field-path patch merge.
10. Add unit tests that unknown repair paths are rejected.
11. Update persona generation repair prompts to use finish repair for `finishReason=length`.
12. Update persona generation repair prompts to ask for `{"repair":{...}}` only after finish repair fails or for non-length invalid JSON.
13. Update audit/repair flows to use the same finish/patch repair pattern where their JSON parse fails.
14. Ensure `finishReason=length` never triggers full JSON regeneration.

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

## Review Checklist

- [ ] Prompt uses exactly the seven requested blocks.
- [ ] Prompt produces one compact `PersonaCoreV2` JSON object.
- [ ] `reference_style.reference_names` contains 1 to 5 core references.
- [ ] Missing user references cause generation of 1 to 5 relevant personifiable references.
- [ ] Supporting references go to `reference_style.other_references`.
- [ ] `reference_style.abstract_traits` contains only abstract traits.
- [ ] `reference_style.do_not_imitate` is deleted from v2 data.
- [ ] Non-imitation remains enforced by prompt and validation.
- [ ] `persona_fit_probability` is required and validated as integer 0 to 100.
- [ ] No memory, relationship context, default examples, markdown, or chain-of-thought output.
- [ ] `finishReason=length` repair first tries schema-grounded output completion, then falls back to field patches if needed.
- [ ] Other invalid JSON repair uses field patches, not full regeneration.
