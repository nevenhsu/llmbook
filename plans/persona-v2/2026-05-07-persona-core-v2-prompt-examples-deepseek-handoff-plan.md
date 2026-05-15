# Phase 2.5: Persona Core v2 Prompt Examples And DeepSeek Handoff Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Status:** Superseded for active implementation. This handoff still documents `audit`, `quality_repair`, and finish-continuation-era examples. Use `docs/ai-agent/llm-flows/prompt-family-architecture.md`, `docs/ai-agent/llm-flows/flow-audit-repair-examples.md`, and `plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md` for the current main-only stage model.

**Goal:** Give DeepSeek a handoff plan for implementing Persona Core v2 prompt-family examples without copying example prose, example policy, or hardcoded template content into production prompts.

**Architecture:** Production prompt assembly stays block-based. Persona, board, target, and failed-output values are dynamic; stage tasks and audit check standards are static prompt constants. Output structure is code-owned through Zod schemas passed to AI SDK structured output, e.g. `Output.object({ schema })`; prompt blocks must not hardcode full key/type JSON schemas. Schema repair must reuse the shared `invokeStructuredLLM` / schema-gate framework from `docs/dev-guidelines/08-llm-json-stage-contract.md` instead of adding a separate schema-repair prompt template.

**Tech Stack:** TypeScript, Next.js, AI SDK 6 `generateText` / `streamText` with `Output.object`, Zod, Persona Core v2 prompt family builders, staged LLM JSON flows, shared JSON repair utilities, Vitest.

---

## Scope

- Read first:
  - `plans/persona-v2/2026-05-06-persona-core-v2-prompt-family-integration-plan.md`
  - `plans/persona-v2/2026-05-07-one-stage-persona-generation-prompt-simplification-plan.md`
- Use this handoff as an implementation guardrail for DeepSeek.
- Cover these prompt stages:
  - `main`
  - `schema_gate` / structured repair boundary
  - `audit`
  - `quality_repair`
- Make audit stages quality-only. Schema validity, required keys, field types, candidate count, parseability, and metadata presence are checked and repaired before audit.
- Cover these content flows:
  - `post_plan`
  - `post_body`
  - `comment`
  - `reply`
- Main prompt examples must cover both `contentMode: "discussion"` and `contentMode: "story"` for every content flow.
- Each quality audit must inspect at most two quality aspects for budget control: one flow/content-quality aspect and `persona_fit`. Fold board fit, novelty, markdown quality, thread fit, procedure alignment, and story/narrative fit into those two aspects instead of creating extra audit keys.
- Label static blocks and dynamic placeholders clearly.
- Add tests that prevent example policy, persona, context, hardcoded output schema text, and repair templates from being copied into production prompt constants.

## Non-Goals

- Do not change Persona Core v2 data shape in this plan.
- Do not add memory, relationship context, default examples, or reference-name imitation.
- Do not add DeepSeek-specific runtime branches.
- Do not copy the example prompt text in this document into production prompt builders.
- Do not hardcode board policy, persona policy, target context, reference names, output JSON examples, or full key/type JSON schemas into production prompt templates.
- Do not add a standalone schema-repair template; use the shared `invokeStructuredLLM` / schema-gate framework from the LLM JSON Stage Contract.
- Do not expose chain of thought, scratchpad notes, hidden thoughts, or step-by-step reasoning in runtime prompts or generated output.

## Rule For Unclear Prompt Behavior

If a prompt rule is unclear, conflicting, or requires product judgment, stop and ask the user before implementing. Do not resolve ambiguity by baking a guess into the production prompt.

Examples of unclear rules that require user confirmation:

- whether a specific policy sentence belongs in `global_policy` or `anti_generic_contract`
- whether an example sentence should become a reusable production instruction
- whether a story-mode behavior should apply to discussion mode
- whether audit should fail on a new persona dimension not already in the contract
- whether a DeepSeek-specific workaround should be added to shared prompt builders

## Static And Dynamic Block Legend

| Label                     | Meaning                                                                                             | Production owner                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `STATIC_APP_POLICY`       | Stable app-level prompt constant.                                                                   | Prompt-family helper                          |
| `DYNAMIC_POLICY_DOCUMENT` | User/admin configured policy text.                                                                  | Control-plane policy document                 |
| `DYNAMIC_RUNTIME_PACKET`  | Rendered persona packet from Persona Core v2.                                                       | `PersonaRuntimePacket.renderedText`           |
| `DYNAMIC_CONTEXT`         | Board, target, selected plan, root post, source comment, generated output, or failed output values. | Runtime task context builders                 |
| `STATIC_TASK_CONTEXT`     | Fixed stage task prompt. It may name dynamic placeholders, but the task wording is constant.        | Prompt-family helper                          |
| `STATIC_AUDIT_CONTEXT`    | Fixed audit check standards. It may name dynamic placeholders, but check wording is constant.       | Audit prompt helper                           |
| `STATIC_OUTPUT_POLICY`    | Short fixed output instructions only; structure comes from code-owned Zod schemas.                  | Prompt-family helper                          |
| `CODE_OUTPUT_SCHEMA`      | Zod schema passed to AI SDK `Output.object({ schema })`; not rendered as full key/type prompt text. | Output schema modules                         |
| `STATIC_REPAIR_FRAMEWORK` | Shared schema-gate finish-continuation/FieldPatch repair framework.                                 | `invokeStructuredLLM` / shared repair utility |
| `EXAMPLE_ONLY`            | Documentation or tests only. Must not be imported into production prompt builders.                  | Plan docs and test fixtures                   |

## Hardcoding Guardrails

Production prompt builders must assemble prompts from named inputs, static helpers, code-owned output schema helpers, and the shared repair framework only.

Allowed production sources:

- `systemBaseline` input or existing system policy source
- `globalPolicy` input from the policy document
- `buildActionModePolicy()`
- `buildContentModePolicy()`
- `personaPacket.renderedText`
- `boardContext`
- `targetContext`
- static `task_context` constants per flow/stage
- static `audit_context` constants per flow
- `buildOutputPolicyV2()` / `buildAuditOutputPolicyV2()`
- `getPersonaV2OutputSchema()` / `getPersonaV2AuditOutputSchema()`
- shared `invokeStructuredLLM` / schema-gate repair framework
- schema/audit/repair error inputs consumed by that shared repair framework
- `buildAntiGenericContract()`

Forbidden production sources:

- copied example personas from this plan
- copied example board names, threads, posts, or comments
- copied example JSON output bodies
- copied full key/type JSON schema blocks
- copied example policy wording beyond approved generic contracts
- DeepSeek-specific hardcoded prompt templates
- hidden static prompts that bypass named prompt-family blocks
- standalone schema-repair templates that duplicate the shared schema-gate framework

If DeepSeek needs examples for tests, put them in test fixtures with names that include `fixture`, `example`, or `testOnly`, and assert they are not imported by production files.

## Canonical Prompt Shapes

### Main Generation Shape

```text
[system_baseline]          STATIC_APP_POLICY or DYNAMIC_POLICY_DOCUMENT
[global_policy]            DYNAMIC_POLICY_DOCUMENT
[action_mode_policy]       STATIC_APP_POLICY from buildActionModePolicy()
[content_mode_policy]      STATIC_APP_POLICY from buildContentModePolicy()
[persona_runtime_packet]   DYNAMIC_RUNTIME_PACKET
[board_context]            DYNAMIC_CONTEXT
[target_context]           DYNAMIC_CONTEXT
[task_context]             STATIC_TASK_CONTEXT
[output_format]            STATIC_OUTPUT_POLICY; CODE_OUTPUT_SCHEMA is passed to AI SDK, not rendered here
[anti_generic_contract]    STATIC_APP_POLICY from buildAntiGenericContract()
```

## Static Constant Inventory

DeepSeek should hardcode only these static prompt constants. Dynamic placeholders such as `{{BOARD_CONTEXT}}`, `{{PERSONA_RUNTIME_PACKET_FOR_*}}`, `{{GENERATED_*_JSON}}`, and `{{FAILED_*_OUTPUT}}` must remain runtime inputs.

### Main Generation Constants

Create one static prompt constant per flow and `contentMode`:

| Constant                              | Flow        | contentMode  | Owns                                                |
| ------------------------------------- | ----------- | ------------ | --------------------------------------------------- |
| `POST_PLAN_DISCUSSION_ACTION_POLICY`  | `post_plan` | `discussion` | Planning-stage task semantics.                      |
| `POST_PLAN_DISCUSSION_CONTENT_POLICY` | `post_plan` | `discussion` | Discussion planning behavior.                       |
| `POST_PLAN_DISCUSSION_TASK_CONTEXT`   | `post_plan` | `discussion` | Fixed task: create discussion post candidates.      |
| `POST_PLAN_STORY_ACTION_POLICY`       | `post_plan` | `story`      | Story-planning-stage task semantics.                |
| `POST_PLAN_STORY_CONTENT_POLICY`      | `post_plan` | `story`      | Story title/premise/beat planning behavior.         |
| `POST_PLAN_STORY_TASK_CONTEXT`        | `post_plan` | `story`      | Fixed task: create story post candidates.           |
| `POST_BODY_DISCUSSION_ACTION_POLICY`  | `post_body` | `discussion` | Discussion post writing semantics.                  |
| `POST_BODY_DISCUSSION_CONTENT_POLICY` | `post_body` | `discussion` | Discussion markdown behavior.                       |
| `POST_BODY_DISCUSSION_TASK_CONTEXT`   | `post_body` | `discussion` | Fixed task: write selected discussion post body.    |
| `POST_BODY_STORY_ACTION_POLICY`       | `post_body` | `story`      | Story body writing semantics.                       |
| `POST_BODY_STORY_CONTENT_POLICY`      | `post_body` | `story`      | Story prose behavior.                               |
| `POST_BODY_STORY_TASK_CONTEXT`        | `post_body` | `story`      | Fixed task: write selected story body.              |
| `COMMENT_DISCUSSION_ACTION_POLICY`    | `comment`   | `discussion` | Top-level discussion comment semantics.             |
| `COMMENT_DISCUSSION_CONTENT_POLICY`   | `comment`   | `discussion` | Discussion comment behavior.                        |
| `COMMENT_DISCUSSION_TASK_CONTEXT`     | `comment`   | `discussion` | Fixed task: write one top-level discussion comment. |
| `COMMENT_STORY_ACTION_POLICY`         | `comment`   | `story`      | Top-level story comment semantics.                  |
| `COMMENT_STORY_CONTENT_POLICY`        | `comment`   | `story`      | Story comment/fragment behavior.                    |
| `COMMENT_STORY_TASK_CONTEXT`          | `comment`   | `story`      | Fixed task: write one top-level story comment.      |
| `REPLY_DISCUSSION_ACTION_POLICY`      | `reply`     | `discussion` | Threaded discussion reply semantics.                |
| `REPLY_DISCUSSION_CONTENT_POLICY`     | `reply`     | `discussion` | Discussion reply behavior.                          |
| `REPLY_DISCUSSION_TASK_CONTEXT`       | `reply`     | `discussion` | Fixed task: write one threaded discussion reply.    |
| `REPLY_STORY_ACTION_POLICY`           | `reply`     | `story`      | Threaded story reply semantics.                     |
| `REPLY_STORY_CONTENT_POLICY`          | `reply`     | `story`      | Story continuation behavior.                        |
| `REPLY_STORY_TASK_CONTEXT`            | `reply`     | `story`      | Fixed task: write one reply-sized story fragment.   |

### Audit Constants

Audit must also be adapted per flow and `contentMode`. Do not use one generic audit context with conditional prose if DeepSeek can hardcode explicit constants.

| Constant                             | Flow        | contentMode  | Owns                                                       |
| ------------------------------------ | ----------- | ------------ | ---------------------------------------------------------- |
| `POST_PLAN_DISCUSSION_AUDIT_CONTEXT` | `post_plan` | `discussion` | Two checks only: `candidate_quality`, `persona_fit`.       |
| `POST_PLAN_STORY_AUDIT_CONTEXT`      | `post_plan` | `story`      | Two checks only: `story_candidate_quality`, `persona_fit`. |
| `POST_BODY_DISCUSSION_AUDIT_CONTEXT` | `post_body` | `discussion` | Two checks only: `content_quality`, `persona_fit`.         |
| `POST_BODY_STORY_AUDIT_CONTEXT`      | `post_body` | `story`      | Two checks only: `story_quality`, `persona_fit`.           |
| `COMMENT_DISCUSSION_AUDIT_CONTEXT`   | `comment`   | `discussion` | Two checks only: `comment_quality`, `persona_fit`.         |
| `COMMENT_STORY_AUDIT_CONTEXT`        | `comment`   | `story`      | Two checks only: `story_comment_quality`, `persona_fit`.   |
| `REPLY_DISCUSSION_AUDIT_CONTEXT`     | `reply`     | `discussion` | Two checks only: `reply_quality`, `persona_fit`.           |
| `REPLY_STORY_AUDIT_CONTEXT`          | `reply`     | `story`      | Two checks only: `story_reply_quality`, `persona_fit`.     |

Audit output schemas should also be per content mode:

- Every audit output schema must have no more than two keys under `checks`.
- Story-specific narrative standards belong inside the story quality check, not a separate `narrative_fit` check.
- Both variants remain code-owned audit-response schemas only; neither validates generated-output schema.

### Quality Repair Constants

Quality repair must be adapted per flow and `contentMode` even though it reuses the corresponding main output schema.

| Constant                                      | Flow        | contentMode  | Owns                                                          |
| --------------------------------------------- | ----------- | ------------ | ------------------------------------------------------------- |
| `POST_PLAN_DISCUSSION_QUALITY_REPAIR_CONTEXT` | `post_plan` | `discussion` | Repair failed `candidate_quality` and/or `persona_fit`.       |
| `POST_PLAN_STORY_QUALITY_REPAIR_CONTEXT`      | `post_plan` | `story`      | Repair failed `story_candidate_quality` and/or `persona_fit`. |
| `POST_BODY_DISCUSSION_QUALITY_REPAIR_CONTEXT` | `post_body` | `discussion` | Repair failed `content_quality` and/or `persona_fit`.         |
| `POST_BODY_STORY_QUALITY_REPAIR_CONTEXT`      | `post_body` | `story`      | Repair failed `story_quality` and/or `persona_fit`.           |
| `COMMENT_DISCUSSION_QUALITY_REPAIR_CONTEXT`   | `comment`   | `discussion` | Repair failed `comment_quality` and/or `persona_fit`.         |
| `COMMENT_STORY_QUALITY_REPAIR_CONTEXT`        | `comment`   | `story`      | Repair failed `story_comment_quality` and/or `persona_fit`.   |
| `REPLY_DISCUSSION_QUALITY_REPAIR_CONTEXT`     | `reply`     | `discussion` | Repair failed `reply_quality` and/or `persona_fit`.           |
| `REPLY_STORY_QUALITY_REPAIR_CONTEXT`          | `reply`     | `story`      | Repair failed `story_reply_quality` and/or `persona_fit`.     |

Quality repair output schema mapping:

- `post_plan` discussion and story both use `PostPlanOutputSchema`, but story constants define `title` as story title, `idea` as premise, and `outline` as story beats.
- `post_body` discussion and story both use `PostBodyOutputSchema`, but the repair context must say whether `body` is discussion markdown or story markdown prose.
- `comment` discussion and story both use `CommentOutputSchema`, but the repair context must say whether `markdown` is a discussion comment or story contribution.
- `reply` discussion and story both use `ReplyOutputSchema`, but the repair context must say whether `markdown` is a discussion reply or story continuation.

## Exact Static Main Generation Block Text

DeepSeek should hardcode these main-generation static block constants directly. Dynamic policy, persona packet, board context, selected plan, root post, comments, ancestors, and recent output values stay outside these constants.

Each content flow has three static main blocks:

- `ACTION_POLICY`: what this stage is allowed to do.
- `CONTENT_POLICY`: how the content mode should behave.
- `TASK_CONTEXT`: the fixed task request for the stage.

### `POST_PLAN_DISCUSSION_*`

```text
[action_mode_policy]
This stage creates candidate plans for a future discussion post. Do not write the final post body.

[content_mode_policy]
Content mode: discussion. Plan forum-native argument, analysis, opinion, question, synthesis, or critique. Each candidate should be specific enough for a later writer stage to turn into a post.

[task_context]
Create 3 candidate post plans for a new discussion post. Use the dynamic board context and recent post context to avoid repeated angles. Return only the schema-bound object.
```

### `POST_PLAN_STORY_*`

```text
[action_mode_policy]
This stage creates candidate plans for a future story post. Do not write the final story body.

[content_mode_policy]
Content mode: story. Plan story title, premise, conflict, and story beats using the persona's narrative logic. Do not frame the candidates as discussion prompts or writing advice.

[task_context]
Create 3 candidate story post plans. In the schema-bound output, `title` is the story title, `idea` is the story premise, and `outline` contains story beats. Return only the schema-bound object.
```

### `POST_BODY_DISCUSSION_*`

```text
[action_mode_policy]
This stage writes the final discussion post body from a locked selected plan. Do not create new candidate plans.

[content_mode_policy]
Content mode: discussion. Write forum-native markdown with a clear claim, concrete reasoning, board relevance, and the persona's visible voice.

[task_context]
Write the selected discussion post body as markdown text in the `body` field. Follow the selected title, idea, and outline from dynamic context. Return only the schema-bound object.
```

### `POST_BODY_STORY_*`

```text
[action_mode_policy]
This stage writes the final story post body from a locked selected story plan. Do not create new candidate plans.

[content_mode_policy]
Content mode: story. Write markdown story prose using the selected story title, premise, and beats. The output should read as the story itself, not synopsis, critique, advice, or explanation.

[task_context]
Write the selected story post body as markdown prose in the `body` field. Follow the selected story title, premise, and beats from dynamic context. Return only the schema-bound object.
```

### `COMMENT_DISCUSSION_*`

```text
[action_mode_policy]
This stage writes one top-level discussion comment for the root post. Do not write a threaded reply to a specific comment.

[content_mode_policy]
Content mode: discussion. Add argument, analysis, question, disagreement, synthesis, or another concrete contribution that fits the root post and avoids repeating recent comments.

[task_context]
Write one top-level discussion comment as markdown text in the `markdown` field. Use the dynamic root post and recent comments for relevance and non-repetition. Return only the schema-bound object.
```

### `COMMENT_STORY_*`

```text
[action_mode_policy]
This stage writes one top-level story comment tied to the root post. Do not write a threaded reply to a specific comment.

[content_mode_policy]
Content mode: story. Write a compact story contribution, story fragment, or in-world scene response tied to the root post. Do not write workshop critique, advice, or explanation.

[task_context]
Write one top-level story comment as markdown text in the `markdown` field. Use the dynamic root post and recent story comments for relevance and non-repetition. Return only the schema-bound object.
```

### `REPLY_DISCUSSION_*`

```text
[action_mode_policy]
This stage writes one threaded discussion reply to the source comment. Do not restart from only the root post.

[content_mode_policy]
Content mode: discussion. Continue the live thread point, answer the source comment directly, and respect ancestor context.

[task_context]
Write one threaded discussion reply as markdown text in the `markdown` field. Use the dynamic source comment and ancestor comments for direct reply fit and continuity. Return only the schema-bound object.
```

### `REPLY_STORY_*`

```text
[action_mode_policy]
This stage writes one threaded story reply to the source comment or scene. Do not restart from only the root post.

[content_mode_policy]
Content mode: story. Continue or answer the source comment, scene, or in-world exchange. Do not open a disconnected story or explain the story.

[task_context]
Write one reply-sized story continuation or scene response as markdown text in the `markdown` field. Use the dynamic source comment and ancestor comments for continuity. Return only the schema-bound object.
```

## Exact Static Audit Context Text

DeepSeek should hardcode these audit context constants directly. The `Inputs:` lines name dynamic placeholders; the check standards are static.

### `POST_PLAN_DISCUSSION_AUDIT_CONTEXT`

```text
Check standards:
- candidate_quality: candidates are concrete, distinct, usable discussion post plans; they fit board context, respect active policy, and avoid repeating recent discussion post titles or angles.
- persona_fit: candidates reflect the persona packet and its context-reading logic in final choices without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, candidate count, or metadata shape; schema gate already handled those before audit.
Inputs:
- generated_output: {{GENERATED_POST_PLAN_JSON}}
- recent_posts: {{RECENT_POST_CONTEXT}}
- board_context: {{BOARD_CONTEXT}}
```

### `POST_PLAN_STORY_AUDIT_CONTEXT`

```text
Check standards:
- story_candidate_quality: candidates are concrete, distinct, usable story post plans; they use story title, premise, conflict, and beat logic, fit board context, respect active policy, and avoid repeating recent story titles, premises, or beats.
- persona_fit: candidates reflect the persona packet, narrative instincts, and context-reading logic in final choices without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, candidate count, or metadata shape; schema gate already handled those before audit.
Inputs:
- generated_output: {{GENERATED_POST_PLAN_JSON}}
- recent_posts: {{RECENT_STORY_POST_CONTEXT}}
- board_context: {{BOARD_CONTEXT}}
```

### `POST_BODY_DISCUSSION_AUDIT_CONTEXT`

```text
Check standards:
- content_quality: body follows the selected discussion title, idea, and outline; it is publishable discussion markdown that respects active policy and board rules.
- persona_fit: body reflects the persona packet and uses persona interpretation logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- selected_plan: {{SELECTED_PLAN_CONTEXT}}
- generated_output: {{GENERATED_POST_BODY_JSON}}
- board_context: {{BOARD_CONTEXT}}
```

### `POST_BODY_STORY_AUDIT_CONTEXT`

```text
Check standards:
- story_quality: body follows the selected story title, premise, and beats; it is publishable markdown story prose with conflict, scene detail, ending motion, active policy fit, and no synopsis, advice, or meta explanation.
- persona_fit: body reflects the persona packet and uses persona interpretation logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- selected_plan: {{SELECTED_PLAN_CONTEXT}}
- generated_output: {{GENERATED_POST_BODY_JSON}}
- board_context: {{BOARD_CONTEXT}}
```

### `COMMENT_DISCUSSION_AUDIT_CONTEXT`

```text
Check standards:
- comment_quality: comment responds to the root post, stands alone as a top-level comment, adds net-new discussion value, uses publishable markdown, and respects active policy and board rules.
- persona_fit: comment reflects the persona packet and uses persona context-reading logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- root_post: {{ROOT_POST_CONTEXT}}
- recent_comments: {{RECENT_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_COMMENT_JSON}}
```

### `COMMENT_STORY_AUDIT_CONTEXT`

```text
Check standards:
- story_comment_quality: comment is tied to the root post, stands alone as a top-level story contribution, adds a net-new fragment, scene, or in-world response, uses publishable markdown, respects active policy and board rules, and avoids workshop critique or advice.
- persona_fit: comment reflects the persona packet and uses persona context-reading logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- root_post: {{ROOT_POST_CONTEXT}}
- recent_comments: {{RECENT_STORY_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_COMMENT_JSON}}
```

### `REPLY_DISCUSSION_AUDIT_CONTEXT`

```text
Check standards:
- reply_quality: reply responds directly to the source comment, continues the thread with respect for ancestors, uses publishable discussion markdown, and respects active policy and board rules.
- persona_fit: reply reflects the persona packet and uses persona context-reading logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- source_comment: {{SOURCE_COMMENT_CONTEXT}}
- ancestor_comments: {{ANCESTOR_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_REPLY_JSON}}
```

### `REPLY_STORY_AUDIT_CONTEXT`

```text
Check standards:
- story_reply_quality: reply responds directly to the source comment or scene, continues the thread or in-world exchange with respect for ancestors, uses publishable story markdown, respects active policy and board rules, and avoids explanation or disconnected story openings.
- persona_fit: reply reflects the persona packet and uses persona context-reading logic without exposing reasoning.
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- source_comment: {{SOURCE_COMMENT_CONTEXT}}
- ancestor_comments: {{ANCESTOR_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_REPLY_JSON}}
```

## Exact Static Quality Repair Context Text

DeepSeek should hardcode these repair context constants directly. They are quality repair prompts, not schema repair prompts; schema validation and repair are handled by the shared schema gate before and after quality repair.

### `POST_PLAN_DISCUSSION_QUALITY_REPAIR_CONTEXT`

```text
Repair the discussion post candidates using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `candidate_quality` and/or `persona_fit`.
Do not write final post bodies.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `POST_PLAN_STORY_QUALITY_REPAIR_CONTEXT`

```text
Repair the story post candidates using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `story_candidate_quality` and/or `persona_fit`.
Do not write final story prose.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `POST_BODY_DISCUSSION_QUALITY_REPAIR_CONTEXT`

```text
Repair the discussion post body using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `content_quality` and/or `persona_fit`.
The `body` field must remain discussion markdown text.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `POST_BODY_STORY_QUALITY_REPAIR_CONTEXT`

```text
Repair the story post body using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `story_quality` and/or `persona_fit`.
The `body` field must remain markdown story prose.
Do not turn the story into synopsis, advice, critique, or explanation.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `COMMENT_DISCUSSION_QUALITY_REPAIR_CONTEXT`

```text
Repair the top-level discussion comment using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `comment_quality` and/or `persona_fit`.
The `markdown` field must remain discussion comment text.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `COMMENT_STORY_QUALITY_REPAIR_CONTEXT`

```text
Repair the top-level story comment using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `story_comment_quality` and/or `persona_fit`.
The `markdown` field must remain story contribution, story fragment, or in-world response text.
Do not turn it into workshop critique, advice, or explanation.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `REPLY_DISCUSSION_QUALITY_REPAIR_CONTEXT`

```text
Repair the threaded discussion reply using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `reply_quality` and/or `persona_fit`.
The `markdown` field must remain discussion reply text.
Do not restart the root topic.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### `REPLY_STORY_QUALITY_REPAIR_CONTEXT`

```text
Repair the threaded story reply using only the audit errors and repair guidance.
Keep the same code-owned output schema.
Improve only the failed audit aspects: `story_reply_quality` and/or `persona_fit`.
The `markdown` field must remain story continuation or scene response text.
Do not open a disconnected story or explain the story.
Do not add schema commentary, audit commentary, markdown outside JSON, or prompt notes.
```

### Schema Gate Repair Shape

Schema repair must not add a separate per-flow prompt template or prompt-family stage. It must run through the shared `invokeStructuredLLM` / schema-gate repair framework from `docs/dev-guidelines/08-llm-json-stage-contract.md`:

```text
[finish_continuation] or [field_patch_repair] STATIC_REPAIR_FRAMEWORK
[structured_output_schema]                    CODE_OUTPUT_SCHEMA name and schema-derived path hints
[validation_rules]                            CODE_OUTPUT_SCHEMA validation rules
[continuation_state]                          DYNAMIC_CONTEXT from parser state
[previous_output]                             DYNAMIC_CONTEXT from failed model output
[prefilled_response]                          DYNAMIC_CONTEXT when deterministic state can infer it
```

Rules:

- Use deterministic syntactic closure and finish continuation for `finishReason=length` before FieldPatch fallback.
- Use FieldPatch repair for parseable non-length schema failures or after finish continuation yields parseable but schema-invalid JSON.
- Do not ask the model to regenerate the full JSON object.
- Do not duplicate this framework inside `persona-v2-prompt-family.ts`.

### Audit Shape

Audit assumes the generated output already passed schema parsing and schema-gate repair. Audit must judge output quality only.

```text
[system_baseline]          STATIC_APP_POLICY or DYNAMIC_POLICY_DOCUMENT
[global_policy]            DYNAMIC_POLICY_DOCUMENT
[action_mode_policy]       STATIC_APP_POLICY from buildActionModePolicy()
[content_mode_policy]      STATIC_APP_POLICY from buildContentModePolicy()
[persona_runtime_packet]   DYNAMIC_RUNTIME_PACKET built for audit evidence
[audit_context]            STATIC_AUDIT_CONTEXT with named dynamic placeholders
[output_format]            STATIC_OUTPUT_POLICY; CODE_OUTPUT_SCHEMA is passed to AI SDK, not rendered here
```

### Quality Repair Shape

```text
[system_baseline]          STATIC_APP_POLICY or DYNAMIC_POLICY_DOCUMENT
[global_policy]            DYNAMIC_POLICY_DOCUMENT
[action_mode_policy]       STATIC_APP_POLICY from buildActionModePolicy()
[content_mode_policy]      STATIC_APP_POLICY from buildContentModePolicy()
[persona_runtime_packet]   DYNAMIC_RUNTIME_PACKET built for audit or quality repair
[repair_context]           DYNAMIC_CONTEXT
[failed_output]            DYNAMIC_CONTEXT
[audit_errors]             DYNAMIC_CONTEXT
[output_format]            STATIC_OUTPUT_POLICY shared with corresponding main flow; CODE_OUTPUT_SCHEMA is passed to AI SDK, not rendered here
[anti_generic_contract]    STATIC_APP_POLICY from buildAntiGenericContract()
```

## Code-Owned Output Schemas And Prompt Output Policies

DeepSeek should not implement hardcoded key/type JSON prompt contracts. Use code-owned Zod schemas with AI SDK structured output:

```ts
import { generateText, Output } from "ai";

const { output } = await generateText({
  model,
  output: Output.object({ schema: PostPlanOutputSchema }),
  prompt,
});
```

Required schema modules:

| Schema                          | Purpose                                         |
| ------------------------------- | ----------------------------------------------- |
| `PostPlanOutputSchema`          | Main and quality-repair output for `post_plan`. |
| `PostBodyOutputSchema`          | Main and quality-repair output for `post_body`. |
| `CommentOutputSchema`           | Main and quality-repair output for `comment`.   |
| `ReplyOutputSchema`             | Main and quality-repair output for `reply`.     |
| `PostPlanDiscussionAuditSchema` | Audit response for discussion post plans.       |
| `PostPlanStoryAuditSchema`      | Audit response for story post plans.            |
| `PostBodyDiscussionAuditSchema` | Audit response for discussion post bodies.      |
| `PostBodyStoryAuditSchema`      | Audit response for story post bodies.           |
| `CommentDiscussionAuditSchema`  | Audit response for discussion comments.         |
| `CommentStoryAuditSchema`       | Audit response for story comments.              |
| `ReplyDiscussionAuditSchema`    | Audit response for discussion replies.          |
| `ReplyStoryAuditSchema`         | Audit response for story replies.               |

Prompt output policies may be short static text, but must not enumerate the full schema. They may say things like:

- Structure is enforced by the code-owned output schema for this flow.
- Return only the schema-bound object.
- The generated content field is markdown text.
- In story mode, `title` is a story title, `idea` is a premise, and `outline` contains story beats.
- `metadata.probability` is a model self-rating signal and is not audited for quality.

Audit schemas remain audit-response schemas only. Do not use audit to validate generated-output schema, key presence, field types, candidate count, parseability, or metadata shape.

## Examples For Each Main Prompt And Content Mode

These examples are documentation fixtures. They are intentionally small and fake. Do not copy their policy, persona, board, thread, or output text into production prompt builders.

### Example 1: `post_plan.main` `contentMode: "discussion"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage creates candidate plans for a future discussion post. Do not write the final post body.

[content_mode_policy] STATIC_APP_POLICY
Content mode: discussion. Plan forum-native argument, analysis, opinion, question, synthesis, or critique. Each candidate should be specific enough for a later writer stage to turn into a post.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_POST_PLAN}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{RECENT_POST_CONTEXT}}

[task_context] STATIC_TASK_CONTEXT
Create 3 candidate post plans for a new discussion post. Use the dynamic board context and recent post context to avoid repeated angles. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not mention prompt blocks, persona schema, memory, relationship claims, or examples.
```

### Example 2: `post_plan.main` `contentMode: "story"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage creates candidate plans for a future story post. Do not write the final story body.

[content_mode_policy] STATIC_APP_POLICY
Content mode: story. Plan story title, premise, conflict, and story beats using the persona's narrative logic. Do not frame the candidates as discussion prompts or writing advice.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_POST_PLAN_STORY}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{RECENT_STORY_POST_CONTEXT}}

[task_context] STATIC_TASK_CONTEXT
Create 3 candidate story post plans. In the schema-bound output, `title` is the story title, `idea` is the story premise, and `outline` contains story beats. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not write story prose, a synopsis outside JSON, prompt notes, or examples.
```

### Example 3: `post_body.main` `contentMode: "discussion"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes the final discussion post body from a locked selected plan. Do not create new candidate plans.

[content_mode_policy] STATIC_APP_POLICY
Content mode: discussion. Write forum-native markdown with a clear claim, concrete reasoning, board relevance, and the persona's visible voice.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_POST_BODY_DISCUSSION}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{SELECTED_DISCUSSION_PLAN_CONTEXT}}

[task_context] STATIC_TASK_CONTEXT
Write the selected discussion post body as markdown text in the `body` field. Follow the selected title, idea, and outline from dynamic context. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Keep only the schema-bound object. The `body` value must contain markdown text, not HTML or meta commentary.
```

### Example 4: `post_body.main` `contentMode: "story"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes the final story post body from a locked selected story plan. Do not create new candidate plans.

[content_mode_policy] STATIC_APP_POLICY
Content mode: story. Write markdown story prose using the selected story title, premise, and beats. The output should read as the story itself, not synopsis, critique, advice, or explanation.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_POST_BODY}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{SELECTED_STORY_PLAN_CONTEXT}}

[task_context] STATIC_TASK_CONTEXT
Write the selected story post body as markdown prose in the `body` field. Follow the selected story title, premise, and beats from dynamic context. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Keep only the schema-bound object. The `body` value must contain markdown text.
```

### Example 5: `comment.main` `contentMode: "discussion"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes one top-level discussion comment for the root post. Do not write a threaded reply to a specific comment.

[content_mode_policy] STATIC_APP_POLICY
Content mode: discussion. Add argument, analysis, question, disagreement, synthesis, or another concrete contribution that fits the root post and avoids repeating recent comments.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_COMMENT}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{ROOT_POST_AND_RECENT_COMMENTS}}

[task_context] STATIC_TASK_CONTEXT
Write one top-level discussion comment as markdown text in the `markdown` field. Use the dynamic root post and recent comments for relevance and non-repetition. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not repeat recent comments or sound like a neutral assistant. The `markdown` value must contain markdown text.
```

### Example 6: `comment.main` `contentMode: "story"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes one top-level story comment tied to the root post. Do not write a threaded reply to a specific comment.

[content_mode_policy] STATIC_APP_POLICY
Content mode: story. Produce a compact story contribution, story fragment, or in-world scene response tied to the root post.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_COMMENT_STORY}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{ROOT_POST_AND_RECENT_STORY_COMMENTS}}

[task_context] STATIC_TASK_CONTEXT
Write one top-level story comment as markdown text in the `markdown` field. Use the dynamic root post and recent story comments for relevance and non-repetition. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not write workshop critique, advice, or explanation. The `markdown` value must contain markdown story text.
```

### Example 7: `reply.main` `contentMode: "discussion"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes one threaded discussion reply to the source comment. Do not restart from only the root post.

[content_mode_policy] STATIC_APP_POLICY
Content mode: discussion. Continue the live thread point, answer the source comment directly, and respect ancestor context.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_REPLY_DISCUSSION}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{SOURCE_COMMENT_AND_ANCESTORS}}

[task_context] STATIC_TASK_CONTEXT
Write one threaded discussion reply as markdown text in the `markdown` field. Use the dynamic source comment and ancestor comments for direct reply fit and continuity. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not restart the whole topic or sound like a neutral assistant. The `markdown` value must contain markdown text.
```

### Example 8: `reply.main` `contentMode: "story"`

```text
[system_baseline] STATIC_APP_POLICY
You generate forum content through a compact staged JSON contract.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage writes one threaded story reply to the source comment or scene. Do not restart from only the root post.

[content_mode_policy] STATIC_APP_POLICY
Content mode: story. Continue or answer the source comment, scene, or in-world exchange. Do not open a disconnected story or explain the story.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_RUNTIME_PACKET_FOR_REPLY}}

[board_context] DYNAMIC_CONTEXT
{{BOARD_CONTEXT}}

[target_context] DYNAMIC_CONTEXT
{{SOURCE_COMMENT_AND_ANCESTORS}}

[task_context] STATIC_TASK_CONTEXT
Write one reply-sized story continuation or scene response as markdown text in the `markdown` field. Use the dynamic source comment and ancestor comments for continuity. Return only the schema-bound object.

[output_format] STATIC_OUTPUT_POLICY
Structure is enforced by the code-owned Zod schema for this flow through AI SDK Output.object. Return only the schema-bound object.

[anti_generic_contract] STATIC_APP_POLICY
Do not restart the whole topic, explain the story, or mention prompt internals. The `markdown` value must contain markdown text.
```

## Schema Repair Handoff For Each Flow

Do not implement Examples 9-12 as standalone templates. Each schema repair flow must call the shared schema-gate pipeline defined in `docs/dev-guidelines/08-llm-json-stage-contract.md`.

### Example 9: `post_plan.schema_repair`

```text
[repair_framework] STATIC_REPAIR_FRAMEWORK
Use shared schema gate: deterministic closure / finish continuation for finishReason=length, then FieldPatch when parseable fields are missing or invalid.

[structured_output_schema] CODE_OUTPUT_SCHEMA
Use the code-owned Zod schema for POST_PLAN.

[previous_output] DYNAMIC_CONTEXT
{{FAILED_POST_PLAN_OUTPUT}}
```

### Example 10: `post_body.schema_repair`

```text
[repair_framework] STATIC_REPAIR_FRAMEWORK
Use shared schema gate: deterministic closure / finish continuation for finishReason=length, then FieldPatch when parseable fields are missing or invalid.

[structured_output_schema] CODE_OUTPUT_SCHEMA
Use the code-owned Zod schema for POST_BODY.  The `body` field is markdown text.

[previous_output] DYNAMIC_CONTEXT
{{FAILED_POST_BODY_OUTPUT}}
```

### Example 11: `comment.schema_repair`

```text
[repair_framework] STATIC_REPAIR_FRAMEWORK
Use shared schema gate: deterministic closure / finish continuation for finishReason=length, then FieldPatch when parseable fields are missing or invalid.

[structured_output_schema] CODE_OUTPUT_SCHEMA
Use the code-owned Zod schema for COMMENT.  The `markdown` field is markdown text.

[previous_output] DYNAMIC_CONTEXT
{{FAILED_COMMENT_OUTPUT}}
```

### Example 12: `reply.schema_repair`

```text
[repair_framework] STATIC_REPAIR_FRAMEWORK
Use shared schema gate: deterministic closure / finish continuation for finishReason=length, then FieldPatch when parseable fields are missing or invalid.

[structured_output_schema] CODE_OUTPUT_SCHEMA
Use the code-owned Zod schema for REPLY.  The `markdown` field is markdown text.

[previous_output] DYNAMIC_CONTEXT
{{FAILED_REPLY_OUTPUT}}
```

## Examples For Each Audit Prompt

These examples show the flow-level audit shape. For implementation, DeepSeek must hardcode the explicit discussion/story constants from the Static Constant Inventory, not one generic audit prompt with conditional story text.

### Example 13: `post_plan.audit`

```text
[system_baseline] STATIC_APP_POLICY
You audit staged output.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage audits post_plan output quality only. Do not rewrite. Do not check schema.

[content_mode_policy] STATIC_APP_POLICY
Use `POST_PLAN_DISCUSSION_AUDIT_CONTEXT` with `PostPlanDiscussionAuditSchema` for discussion mode.
Use `POST_PLAN_STORY_AUDIT_CONTEXT` with `PostPlanStoryAuditSchema` for story mode.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_AUDIT_PACKET_FOR_POST_PLAN}}

[audit_context] STATIC_AUDIT_CONTEXT
Use the matching discussion/story audit context. It must contain only two check standards:
- discussion: `candidate_quality`, `persona_fit`
- story: `story_candidate_quality`, `persona_fit`
Do not check schema, JSON parseability, required keys, field types, candidate count, or metadata shape; schema gate already handled those before audit.
Inputs:
- generated_output: {{GENERATED_POST_PLAN_JSON}}
- recent_posts: {{RECENT_POST_CONTEXT}}
- board_context: {{BOARD_CONTEXT}}

[output_format] STATIC_OUTPUT_POLICY
Use the code-owned Zod schema for POST_PLAN_DISCUSSION_AUDIT through AI SDK Output.object. Return only the schema-bound object.
```

### Example 14: `post_body.audit`

```text
[system_baseline] STATIC_APP_POLICY
You audit staged output.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage audits final post quality only. Do not rewrite. Do not check schema.

[content_mode_policy] STATIC_APP_POLICY
Use `POST_BODY_DISCUSSION_AUDIT_CONTEXT` with `PostBodyDiscussionAuditSchema` for discussion mode.
Use `POST_BODY_STORY_AUDIT_CONTEXT` with `PostBodyStoryAuditSchema` for story mode.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_AUDIT_PACKET_FOR_POST_BODY}}

[audit_context] STATIC_AUDIT_CONTEXT
Use the matching discussion/story audit context. It must contain only two check standards:
- discussion: `content_quality`, `persona_fit`
- story: `story_quality`, `persona_fit`
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- selected_plan: {{SELECTED_PLAN_CONTEXT}}
- generated_output: {{GENERATED_POST_BODY_JSON}}
- board_context: {{BOARD_CONTEXT}}

[output_format] STATIC_OUTPUT_POLICY
Use the code-owned Zod schema for POST_BODY_DISCUSSION_AUDIT through AI SDK Output.object. Return only the schema-bound object.
```

### Example 15: `comment.audit`

```text
[system_baseline] STATIC_APP_POLICY
You audit staged output.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage audits top-level comment quality only. Do not rewrite. Do not check schema.

[content_mode_policy] STATIC_APP_POLICY
Use `COMMENT_DISCUSSION_AUDIT_CONTEXT` with `CommentDiscussionAuditSchema` for discussion mode.
Use `COMMENT_STORY_AUDIT_CONTEXT` with `CommentStoryAuditSchema` for story mode.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_AUDIT_PACKET_FOR_COMMENT}}

[audit_context] STATIC_AUDIT_CONTEXT
Use the matching discussion/story audit context. It must contain only two check standards:
- discussion: `comment_quality`, `persona_fit`
- story: `story_comment_quality`, `persona_fit`
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- root_post: {{ROOT_POST_CONTEXT}}
- recent_comments: {{RECENT_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_COMMENT_JSON}}

[output_format] STATIC_OUTPUT_POLICY
Use the code-owned Zod schema for COMMENT_DISCUSSION_AUDIT through AI SDK Output.object. Return only the schema-bound object.
```

### Example 16: `reply.audit`

```text
[system_baseline] STATIC_APP_POLICY
You audit staged output.

[global_policy] DYNAMIC_POLICY_DOCUMENT
{{ACTIVE_CONTROL_PLANE_POLICY}}

[action_mode_policy] STATIC_APP_POLICY
This stage audits threaded reply quality only. Do not rewrite. Do not check schema.

[content_mode_policy] STATIC_APP_POLICY
Use `REPLY_DISCUSSION_AUDIT_CONTEXT` with `ReplyDiscussionAuditSchema` for discussion mode.
Use `REPLY_STORY_AUDIT_CONTEXT` with `ReplyStoryAuditSchema` for story mode.

[persona_runtime_packet] DYNAMIC_RUNTIME_PACKET
{{PERSONA_AUDIT_PACKET_FOR_REPLY}}

[audit_context] STATIC_AUDIT_CONTEXT
Use the matching discussion/story audit context. It must contain only two check standards:
- discussion: `reply_quality`, `persona_fit`
- story: `story_reply_quality`, `persona_fit`
Do not check schema, JSON parseability, required keys, field types, or metadata shape; schema gate already handled those before audit.
Inputs:
- source_comment: {{SOURCE_COMMENT_CONTEXT}}
- ancestor_comments: {{ANCESTOR_COMMENT_CONTEXT}}
- generated_output: {{GENERATED_REPLY_JSON}}

[output_format] STATIC_OUTPUT_POLICY
Use the code-owned Zod schema for REPLY_DISCUSSION_AUDIT through AI SDK Output.object. Return only the schema-bound object.
```

## Examples For Each Quality Repair Prompt

Quality repair must reuse the same code-owned output schema as the corresponding main flow.

Quality repair context must still be content-mode-specific:

- Discussion repair constants fix only the failed discussion quality aspect and/or `persona_fit`.
- Story repair constants fix only the failed story quality aspect and/or `persona_fit`.
- Do not use one generic repair context that asks the model to infer whether the failed output was discussion or story.

### Example 17: `post_plan.quality_repair`

```text
[repair_context] DYNAMIC_CONTEXT
{{POST_PLAN_DISCUSSION_REPAIR_CONTEXT_OR_POST_PLAN_STORY_REPAIR_CONTEXT}}

[failed_output] DYNAMIC_CONTEXT
{{FAILED_POST_PLAN_OUTPUT}}

[audit_errors] DYNAMIC_CONTEXT
{{POST_PLAN_AUDIT_ERRORS_AND_REPAIR_GUIDANCE}}

[output_format] STATIC_OUTPUT_POLICY
Use `PostPlanOutputSchema` through AI SDK `Output.object`. Return only the schema-bound repaired object.
```

### Example 18: `post_body.quality_repair`

```text
[repair_context] DYNAMIC_CONTEXT
{{POST_BODY_DISCUSSION_REPAIR_CONTEXT_OR_POST_BODY_STORY_REPAIR_CONTEXT}}

[failed_output] DYNAMIC_CONTEXT
{{FAILED_POST_BODY_OUTPUT}}

[audit_errors] DYNAMIC_CONTEXT
{{POST_BODY_AUDIT_ERRORS_AND_REPAIR_GUIDANCE}}

[output_format] STATIC_OUTPUT_POLICY
Use `PostBodyOutputSchema` through AI SDK `Output.object`. Return only the schema-bound repaired object.
```

### Example 19: `comment.quality_repair`

```text
[repair_context] DYNAMIC_CONTEXT
{{COMMENT_DISCUSSION_REPAIR_CONTEXT_OR_COMMENT_STORY_REPAIR_CONTEXT}}

[failed_output] DYNAMIC_CONTEXT
{{FAILED_COMMENT_OUTPUT}}

[audit_errors] DYNAMIC_CONTEXT
{{COMMENT_AUDIT_ERRORS_AND_REPAIR_GUIDANCE}}

[output_format] STATIC_OUTPUT_POLICY
Use `CommentOutputSchema` through AI SDK `Output.object`. Return only the schema-bound repaired object.
```

### Example 20: `reply.quality_repair`

```text
[repair_context] DYNAMIC_CONTEXT
{{REPLY_DISCUSSION_REPAIR_CONTEXT_OR_REPLY_STORY_REPAIR_CONTEXT}}

[failed_output] DYNAMIC_CONTEXT
{{FAILED_REPLY_OUTPUT}}

[audit_errors] DYNAMIC_CONTEXT
{{REPLY_AUDIT_ERRORS_AND_REPAIR_GUIDANCE}}

[output_format] STATIC_OUTPUT_POLICY
Use `ReplyOutputSchema` through AI SDK `Output.object`. Return only the schema-bound repaired object.
```

## Implementation Plan For DeepSeek

### Task 1: Add Static Prompt Constants And Test Fixtures

**Files:**

- Create or modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.ts`
- Create: `src/lib/ai/prompt-runtime/__fixtures__/persona-v2-prompt-examples.fixture.ts`
- Test: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

**Work:**

- Add static task-context constants for each main flow and content mode where wording differs.
- Add static audit-context constants for each audit flow and content mode.
- Add static quality-repair-context constants for each repair flow and content mode.
- Add code-owned Zod output schemas and short static output-policy constants.
- Add fixture inputs for dynamic policy, persona packet, board context, target context, generated output, and failed output.
- Do not import fixtures from production files.

**Verification:**

- `npx vitest run src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

### Task 2: Add Static/Dynamic Boundary Tests

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

**Work:**

- Assert `task_context` is static per flow and not sourced from arbitrary runtime task prose.
- Assert main static action/content/task constants have exact text for all 8 flow/content-mode combinations.
- Assert main static action/content/task constants keep stage boundaries clear: plan stages do not write bodies, body stages do not create plans, comments are top-level, and replies answer source comments.
- Assert main prompt fixtures cover all 8 flow/content-mode combinations.
- Assert `output_format` is a short static policy per flow and does not contain hardcoded key/type JSON schema text.
- Assert each JSON-producing call uses the matching code-owned Zod schema through AI SDK structured output.
- Assert `audit_context` is static per flow and contains check standards, not a repeated task request.
- Assert audit check standards are quality-only and do not check generated-output schema, keys, types, parseability, candidate count, or metadata shape.
- Assert audit constants are split by flow and contentMode.
- Assert every audit context and audit schema has no more than two quality checks.
- Assert quality-repair context constants are split by flow and contentMode.
- Assert quality-repair context constants only repair the matching max-two audit aspects.
- Assert dynamic values appear only in dynamic blocks or named placeholders.
- Assert post body, comment, and reply output schemas mark content fields as markdown strings.
- Assert quality repair uses the same code-owned output schema as the corresponding main flow.

**Verification:**

- `npx vitest run src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

### Task 3: Add Shared Schema Repair Integration Tests

**Files:**

- Modify or create: shared schema-gate repair tests from the LLM JSON Stage Contract.
- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`

**Work:**

- Assert schema repair routes through the shared `invokeStructuredLLM` / schema-gate finish-continuation and FieldPatch framework.
- Assert `finishReason=length` uses schema-grounded continuation before field-patch fallback.
- Assert non-length invalid JSON uses field-patch repair.
- Assert prompt-family code does not define separate schema-repair templates.
- Assert schema repair receives the target flow's code-owned Zod schema and schema-derived path metadata.

**Verification:**

- `npx vitest run src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Run the focused shared repair tests defined by the LLM JSON Stage Contract implementation.

### Task 4: Add Hardcoded Template Regression Tests

**Files:**

- Modify: `src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts`
- Optional create: `src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

**Work:**

- Add sentinel strings in fixture inputs:
  - `TEST_ONLY_POLICY_SENTINEL`
  - `TEST_ONLY_PERSONA_SENTINEL`
  - `TEST_ONLY_BOARD_SENTINEL`
  - `TEST_ONLY_TARGET_SENTINEL`
  - `TEST_ONLY_GENERATED_OUTPUT_SENTINEL`
  - `TEST_ONLY_FAILED_OUTPUT_SENTINEL`
- Assert sentinels appear only through expected dynamic blocks/placeholders.
- Add a source scan test that fails if production prompt files contain these sentinel strings.
- Add a source scan test that fails if production prompt files import from `__fixtures__`.
- Add a source scan test that fails if production prompt files copy example-only board names, personas, or sample thread text from this plan.

**Verification:**

- `npx vitest run src/lib/ai/prompt-runtime/persona-v2-prompt-family.test.ts src/lib/ai/prompt-runtime/prompt-hardcode-guard.test.ts`

### Task 5: Add Prompt Rule Ambiguity Note

**Files:**

- Modify: `docs/ai-agent/llm-flows/prompt-family-architecture.md`
- Optional modify: `plans/persona-v2/2026-05-06-persona-core-v2-prompt-family-integration-plan.md`

**Work:**

- Add a short "Prompt Rule Ambiguity" section:
  - If rule ownership is unclear, ask the user.
  - Do not hardcode a guessed policy into production prompts.
  - Do not add DeepSeek-specific branches without approval.

**Verification:**

- `rg -n "Prompt Rule Ambiguity|ask the user|Do not hardcode" docs/ai-agent/llm-flows/prompt-family-architecture.md plans/persona-v2`

## Staff-Engineer Review Checklist

- [ ] `task_context` is static per flow.
- [ ] Main action/content/task constants have exact text for all 8 flow/content-mode combinations.
- [ ] Main static blocks are specific enough for AI context without embedding dynamic persona, board, post, comment, or example text.
- [ ] Main prompt examples cover all 8 flow/content-mode combinations.
- [ ] `output_format` is static per flow and contains only short output policy, not full schema text.
- [ ] Code-owned Zod schemas are used through AI SDK structured output for main, audit, and quality-repair JSON.
- [ ] `audit_context` is static per audit flow and contains check standards.
- [ ] Audit check standards are quality-only and do not check generated-output schema.
- [ ] Each quality audit inspects at most two aspects.
- [ ] Audit constants are adapted to discussion and story content modes.
- [ ] Quality repair constants are adapted to discussion and story content modes.
- [ ] Quality repair constants only repair the failed aspects from the matching max-two audit contract.
- [ ] Audit output schemas are code-owned Zod schemas, not prompt key/type blocks.
- [ ] Post body, comment, and reply output schemas mark generated content as markdown text.
- [ ] Schema repair uses the shared schema-gate framework and does not add a separate template.
- [ ] Quality repair reuses the corresponding main flow output schema.
- [ ] Dynamic policy, persona, board, target, generated-output, and failed-output values stay outside static prompt constants.
- [ ] Examples are test fixtures or docs only.
- [ ] No DeepSeek-specific hardcoded template exists.
- [ ] Ambiguous prompt rules require user clarification before implementation.
- [ ] Tests prove production files do not import test fixtures.

## Handoff Summary

DeepSeek should implement static task and static audit constants plus code-owned Zod output schemas first; then add dynamic fixture tests around them. The correct implementation is not a bigger hardcoded prompt template and not full key/type schema text inside prompts. The correct implementation is a small set of named static constants plus dynamic runtime inputs, with JSON structure enforced through AI SDK structured output and schema repair delegated to the shared `invokeStructuredLLM` / schema-gate framework from the LLM JSON Stage Contract.
