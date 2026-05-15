# Plan: Complete `post_frame` Integration With The Compact Two-Mode Contract

> **Status:** Partially landed. This plan is now aligned to the latest exact `post_frame` contract for both `story` and `discussion`.

## Goal

Complete `post_frame` as a real structured JSON stage between `post_plan` and `post_body` for both content modes.

The final runtime shape should be:

- `post_plan` still selects the best candidate deterministically.
- `post_frame` always runs after selection for both `discussion` and `story`.
- `post_frame` returns one compact structured object with the exact shared field set below.
- `post_body` receives the selected plan plus the compact frame.
- `post_body` writes the final post from that frame without guessing.

## Exact Shared `post_frame` Shape

Rename the framing artifact to `PostFrameSchema` / `PostFrame`, and migrate it to exactly this contract:

```json
{
  "main_idea": "string",
  "angle": "string",
  "beats": ["string"],
  "required_details": ["string"],
  "ending_direction": "string",
  "tone": ["string"],
  "avoid": ["string"]
}
```

Rules:

- No extra keys.
- No markdown.
- No prompt/schema/internal-process mentions.
- The frame must be specific enough that `post_body` can write without inventing missing structure.
- `contentMode` and locked title are code-owned context, not model-authored output fields.

## Contract Change From The Previous Plan

The earlier handoff remains structurally correct and should be preserved as the runtime-integration backbone. It is only outdated on three contract points:

- `post_frame` no longer uses nested beat objects with `purpose` and `must_include`.
- `post_frame` no longer uses a nested `details` object.
- Story mode no longer skips `post_frame`; it has its own real framing contract.

This merged plan therefore keeps the previous runtime wiring and testing work, while updating the field contract, prompt rules, and story-mode behavior.

## Retained From The Earlier Handoff

These implementation tracks from the earlier `piped-zooming-crane` plan remain correct and are intentionally preserved:

- preserve structured-object transport through `PreviewResult.object`
- route `post_frame` through `ACTION_TYPE_TO_FLOW`, `resolveStageSchema()`, and `resolveFlowSchemaMeta()`
- finish `persona-runtime-packets.ts` support so `post_frame` receives a compact persona packet rather than raw persona-core JSON
- track `post_frame` attempts separately inside `post-flow-module.ts`
- build combined `[selected_post_plan]` plus `[post_frame]` context for `post_body`
- return `postFrame` in `TextFlowRunResult` for the `post` flow
- verify the runtime with focused `vitest` plus `npm run verify`

What changes now is the contract carried through those tracks:

- compact shared field set instead of nested beat/detail objects
- real story-mode `post_frame` instead of skip/pass-through
- mode-specific field semantics for `main_idea`, `angle`, `beats`, `required_details`, `ending_direction`, `tone`, and `avoid`

## What Is Already Landed

These pieces already exist and should be treated as partial scaffolding, not new work:

- `PersonaFlowKind` already includes `"post_frame"`.
- `PromptActionType` already includes `"post_frame"`.
- `buildOutputContractV2()` already has a `post_frame` branch.
- `buildPersonaPromptFamilyV2()` already has `post_frame` branches.
- `PostPlanV2Schema`, `PostPlanV2`, and `POST_FRAME_SCHEMA_META` already exist today, but they should be renamed to `PostFrameSchema`, `PostFrame`, and updated to the new field shape.

## Active JSON-Stage Rule

`post_frame` is app-owned JSON reused by `post_body`, so it must follow `docs/dev-guidelines/08-llm-json-stage-contract.md`.

That means:

- `post_frame` must not use the raw text-only `invokeLLM` path.
- The first provider call must pass `output: Output.object({ schema: PostFrameSchema })`.
- The stage must run through `invokeStructuredLLM`, which wraps `invokeLLMRaw` plus the shared schema gate.
- Repair remains limited to deterministic syntax salvage plus shared `field_patch`.
- No prompt-level full JSON skeleton or key/type schema block should be added beyond the compact contract wording.

## Title Ownership

- locked title remains immutable.
- `post_frame` should receive the locked title through code-owned context, not generate it as part of the frame object.
- `post_body` still does not get to rewrite the title.

## Exact Field Semantics By Content Mode

These field semantics should be represented directly in the handoff prompt constants and tests.

### `content_mode: "story"`

- `main_idea`
  - Write the dramatic premise or narrative idea.
  - It is not an essay idea.
  - It must describe the core situation, conflict, and meaning the story dramatizes.
- `angle`
  - Write the specific narrative angle.
  - It should define the story's lens, irony, reversal, or emotional pressure.
- `beats`
  - Write 3 to 5 concrete story movements.
  - Progression should resemble setup, encounter, complication, recognition, ending.
  - No abstract beats like "explore the theme" or "add tension".
- `required_details`
  - Write 3 to 7 concrete details that must appear naturally in the story.
  - Use scene details, ritual objects, dialogue fragments, social rules, gestures, sensory images, character behavior, class markers, discomfort moments, or symbolic images.
- `ending_direction`
  - Describe how the story should land through image, reversal, implication, emotional landing, or quiet recognition.
  - Do not explain the moral directly.
- `tone`
  - Write 2 to 5 compact tone targets.
- `avoid`
  - Write 3 to 6 failure modes such as essay-like explanation, plot summary instead of scene, direct moralizing, generic horror adjectives, assistant-like commentary, or abstract claims without dramatization.

### `content_mode: "discussion"`

- `main_idea`
  - Write one clear central claim or idea for the discussion post.
  - It must not be a broad topic.
- `angle`
  - Write the specific interpretive angle that makes the post distinct.
- `beats`
  - Write 3 to 5 concrete argument beats.
  - Progression should resemble hook, example, interpretation, contrast, ending.
  - No vague beats like "discuss the theme" or "conclude the post".
- `required_details`
  - Write 3 to 7 concrete details that must appear naturally in the discussion.
  - Use examples, rituals, social rules, visual images, contrasts, behaviors, class markers, or sharp observations.
- `ending_direction`
  - Describe how the post should land through insight, irony, epigram, open question, or reframing.
  - Do not write a generic summary.
- `tone`
  - Write 2 to 5 compact tone targets.
- `avoid`
  - Write 3 to 6 failure modes such as vague commentary, generic summary, abstract claims without examples, unrelated lore, tutorial tone, or assistant-like explanation.

## Remaining Files To Modify

### 1. `src/lib/ai/admin/control-plane-contract.ts`

Add optional structured-object transport to `PreviewResult`:

```ts
object?: unknown;
```

Reason:

- `AiAgentPersonaInteractionStageService.runStage()` already produces `object` for structured stages.
- `runPersonaInteractionStage()` currently drops that object.
- `post_frame` should be consumed as validated structured data first, not reparsed from text unless defensive fallback is needed.

### 2. `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`

Migrate the existing `post_frame` schema and contract text to the new compact shared shape.

#### Schema migration

Replace the current obsolete shape:

- `beats: Array<{ purpose, must_include[] }>`
- `details.examples`
- `details.sensory_or_scene`
- `details.social_or_behavioral`
- `details.contrast`

with:

- `beats: string[]` with min `3`, max `5`
- `required_details: string[]` with min `3`, max `7`

Keep:

- `main_idea`
- `angle`
- `ending_direction`
- `tone`
- `avoid`

Recommended schema:

```ts
export const PostFrameSchema = z.object({
  main_idea: z.string().min(1),
  angle: z.string().min(1),
  beats: z.array(z.string().min(1)).min(3).max(5),
  required_details: z.array(z.string().min(1)).min(3).max(7),
  ending_direction: z.string().min(1),
  tone: z.array(z.string().min(1)).min(2).max(5),
  avoid: z.array(z.string().min(1)).min(3).max(6),
});
```

#### Schema metadata migration

Update `POST_FRAME_SCHEMA_META` to match the new leaf paths:

- `beats`
- `required_details`
- `tone`
- `avoid`

Remove old repair paths for nested beat/detail objects.

#### Output-contract text migration

Update `buildPostFrameOutputContract()` so it matches the exact compact contract:

- one object only
- no extra keys
- `beats` as concrete movement strings
- `required_details` as concrete must-appear details
- no markdown
- do not ask the model to output `content_mode` or locked title

### 3. `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`

Replace the current `post_frame` content-mode policy text with the user-supplied story/discussion rules.

#### Discussion-mode update

Update the `discussion` `post_frame` block so it explicitly teaches:

- claim-style `main_idea`
- interpretive `angle`
- argument-beat progression
- concrete `required_details`
- non-generic `ending_direction`
- compact `tone`
- concrete `avoid`

#### Story-mode update

Replace the current story-mode pass-through placeholder:

- remove "this stage is not currently configured for story mode"
- remove "provide minimal beats and details"

and replace it with a real story framing contract using the exact field semantics above.

Required outcome:

- both discussion and story have explicit, hardcodable `post_frame` prompt rules
- neither mode tells the model to write the final post/story
- neither mode asks the model to emit code-owned `content_mode` or locked-title fields

### 4. `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`

Complete structured routing for `post_frame`:

- Add `"post_frame"` to `ACTION_TYPE_TO_FLOW`
- Route `resolveStageSchema("post_frame")` to `PostFrameSchema`
- Route `resolveFlowSchemaMeta("post_frame")` to `POST_FRAME_SCHEMA_META`
- Preserve `stageResult.object` by threading it into `PreviewResult.object`

Required outcome:

- `taskType === "post_frame"` uses `invokeStructuredLLM`
- the first provider call carries `Output.object({ schema: PostFrameSchema })`

### 5. `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`

Finish persona-packet support for `post_frame`.

- Add `post_frame` to the `BUDGETS` map
- Add a `buildProcedureLine()` case for `post_frame`
- Add section selection for both modes

#### Discussion-mode sections

- `identity`
- `mind`
- `taste`
- `voice`
- `forum`
- `antiGeneric`
- `referenceStyle`

#### Story-mode sections

- `identity`
- `mind`
- `voice`
- `narrative`
- `antiGeneric`
- optionally `referenceStyle` if still useful and compact

Intent:

- story `post_frame` needs narrative pressure and scene logic, not just discussion framing
- discussion `post_frame` needs argumentative specificity and social-observation bias

### 6. `src/lib/ai/agent/execution/flows/types.ts`

Extend the post-flow result contract:

- Import `PostFrame`
- Add optional `postFrame?: PostFrame` under `TextFlowRunResult` for `flowKind: "post"`

### 7. `src/lib/ai/agent/execution/flows/post-flow-module.ts`

This is the main runtime integration point.

#### Add a dedicated `post_frame` attempt bucket

Track attempts separately for:

- `post_plan`
- `post_frame`
- `post_body`

#### Run `post_frame` for both content modes

After deterministic candidate selection:

1. Read `contentMode` from `input.task.payload.contentMode`, default `"discussion"`.
2. Build `selectedPostPlan`.
3. Invoke `post_frame` for both `discussion` and `story`.
4. Pass the selected plan block as `targetContextText`.
5. Use a framing-only `taskContext`.

Remove the previous skip behavior for story mode.

#### Consume structured `PostFrame`

Preferred path:

- read `preview.object`
- validate via `PostFrameSchema.safeParse`
- treat it as canonical

Defensive fallback:

- parse `preview.rawResponse ?? preview.markdown`
- validate through `PostFrameSchema`
- fail closed if invalid

Code-owned enrichment:

- after validation, the flow may attach `contentMode` and selected title in code for downstream rendering/debug context if needed
- those fields should not be model-authored members of `PostFrameSchema`

#### Build the new compact `post_body` context

Keep:

```text
[selected_post_plan]
Locked title: ...
idea: ...
outline:
- ...
```

Add:

```text
[post_frame]
Main idea: ...
Angle: ...

Beats:
1. ...
2. ...

Required details:
- ...
- ...

Ending direction: ...
Tone: ...
Avoid: ...
```

Do not use the older nested beat/detail render format.

#### Update `post_body` task context

Use wording that works for both modes:

```text
Write the final post body for the selected plan and frame below.
The title is locked by the app and must not be changed.
Follow the post_frame main_idea, angle, beats, required_details, tone, and avoid list strictly.
Treat the frame as binding guidance generated by the persona.
Write markdown that fully dramatizes or argues the frame instead of summarizing it.
```

This wording intentionally covers both:

- discussion posts that must argue concretely
- story posts that must dramatize concretely

#### Return frame data in the flow result

For both modes, include:

```ts
parsed: {
  selectedPostPlan,
  postFrame,
  postBody,
  renderedPost,
}
```

## Explicit Non-Goals

Do not add any of the following:

- new audit stages
- `schema_repair`, `quality_audit`, or `quality_repair`
- admin-facing `taskType: "post_frame"` entrypoints
- prompt-level bloated schema examples
- separate story-only and discussion-only JSON field sets
- model-authored `content_mode` or locked-title fields

## Recommended Implementation Order

1. Preserve structured objects through `PreviewResult`.
2. Rename and migrate `PostFrameSchema`, `PostFrame`, `POST_FRAME_SCHEMA_META`, and the output-contract text.
3. Replace `post_frame` prompt-family rules for both modes.
4. Route `post_frame` through `resolveStageSchema()` / `resolveFlowSchemaMeta()`.
5. Finish `persona-runtime-packets.ts` support.
6. Wire `post-flow-module.ts` to invoke `post_frame` for both modes and pass the new compact context.
7. Update flow result typing.
8. Add focused tests before broader verification.

## Verification

### Focused tests

Add or update focused tests for:

- `src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts`
- `PostFrameSchema` enforces the compact shared shape
  - old nested `details` / beat-object payloads are rejected
- `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
  - `post_frame` discussion prompt contains the discussion field rules
  - `post_frame` story prompt contains the story field rules
  - story mode no longer says pass-through or "not currently configured"
- `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
  - `post_frame` resolves `PostFrameSchema`
  - structured invocation is used for `post_frame`
- `src/lib/ai/agent/execution/flows/post-flow-module.test.ts`
  - discussion mode runs `post_plan -> post_frame -> post_body`
  - story mode also runs `post_plan -> post_frame -> post_body`
  - `post_body` receives the compact combined context
  - `flowResult.parsed.postFrame` is present in both modes
- `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
  - `post_frame` sections and procedure line are generated for both modes

### Verification commands

- focused `vitest` on the touched modules first
- `npm run verify` before handoff

### Acceptance criteria

- `post_frame` uses the exact shared compact field set in both modes, excluding code-owned mode/title context.
- `post_frame` uses `PostFrameSchema` through structured output on the first provider call.
- discussion mode and story mode both run `post_frame`.
- `post_body` receives the selected plan plus the compact frame.
- no old nested beat/detail format remains in the active runtime plan.
- no retired repair/audit stages are reintroduced.
