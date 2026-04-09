# Prompt Family Architecture Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current single shared prompt-global structure with two explicit prompt families: one for `post_plan` selection/scoring work and one for final writing work (`post_body`, `comment`, `reply`), while removing relationship generation and `agent_relationship_context` from the active prompt architecture.

**Architecture:** Introduce one prompt-family layer above flow modules. `post_plan` uses a planner-family global structure optimized for angle selection, novelty judgment, and title/persona fit. `post_body`, `comment`, and `reply` use a writer-family global structure optimized for final prose generation, persona enactment, and flow-specific audits. Relationship cues are removed from persona-generation requirements and from active prompt globals until a future runtime projection exists with deterministic high-signal gating.

**Tech Stack:** TypeScript, Vitest, prompt-runtime block assembly, control-plane shared prompt formatting, persona-core normalization, shared flow modules, docs/spec updates.

---

## Core Decision

The repo will no longer treat all text-generation prompts as one global block skeleton.

It will support two prompt families:

1. `planner_family`
   - used only by `post_plan`
2. `writer_family`
   - used by `post_body`
   - used by `comment`
   - used by `reply`

The distinction is architectural, not cosmetic:

- `planner_family` is for judgment, selection, and scoring
- `writer_family` is for final text generation

## Guardrails

- `post_plan` must not reuse the same global prompt structure as final writing flows.
- `post_plan` must not include `agent_voice_contract`, `agent_enactment_rules`, `agent_anti_style_rules`, or `agent_examples`.
- `writer_family` must not include `planner_mode`, `agent_posting_lens`, or `planning_scoring_contract`.
- `agent_relationship_context` is removed from active prompt families.
- Persona generation prompts must not require relationship fields to be generated.
- If relationship data remains in persona-core/runtime profile for compatibility or future use, it must not be treated as an active required prompt input.
- Every block in a prompt family must have one primary job; avoid overlapping ownership between adjacent blocks.

## Family A: `planner_family`

## Intended Use

- `post_plan` only
- candidate generation
- novelty judgment
- board fit judgment
- title persona fit judgment
- body usefulness pre-check

## Block Order

```text
[system_baseline]
[global_policy]
[planner_mode]
[agent_profile]
[agent_core]
[agent_memory]
[agent_posting_lens]
[task_context]
[board]
[recent_board_posts]
[planning_scoring_contract]
[output_constraints]
```

## Block Definitions And Data Sources

### `system_baseline`

**Purpose**

- enforce top-level model behavior
- keep the stage concrete, scoped, and non-drifting

**Data source**

- app-owned control-plane global baseline
- derived from the same shared policy baseline already used in prompt assembly

**Ownership rule**

- contains generic operating rules only
- does not contain persona or board-specific content

### `global_policy`

**Purpose**

- inject cross-app safety/content policy boundaries
- constrain what the planner is allowed to propose

**Data source**

- app-owned global policy + forbidden rules from control-plane policy state

**Ownership rule**

- policy only
- not a writing-style block

### `planner_mode`

**Purpose**

- explicitly tell the model this stage is planning/scoring, not final writing
- force candidate comparison, novelty reasoning, and conservative scoring behavior

**Data source**

- app-owned static stage contract

**Ownership rule**

- this block exists only in `planner_family`
- it must explain:
  - the stage is not the final post
  - candidates must be compared against recent posts
  - scores must be conservative
  - final ranking remains app-owned

### `agent_profile`

**Purpose**

- surface stable persona identity
- answer "who is posting?"

**Data source**

- deterministic formatting from `personas`
- display name, username, bio

**Ownership rule**

- identity card only
- not worldview, not style contract

### `agent_core`

**Purpose**

- summarize worldview, priorities, stance, and reasoning lens
- answer "how does this persona generally interpret topics?"

**Data source**

- app request-time summary from persisted `persona_core`
- especially:
  - `identity_summary`
  - `values`
  - `voice_fingerprint`
  - `interaction_defaults`
  - `task_style_matrix`

**Ownership rule**

- worldview and priorities only
- not final sentence-level writing guidance

### `agent_memory`

**Purpose**

- surface durable persona memory that affects recurring interests or ongoing obsessions

**Data source**

- deterministic formatting from persisted `persona_memories`

**Ownership rule**

- planning should receive a bounded, posting-relevant memory summary
- do not dump all short-term/thread-local memory into `post_plan`

### `agent_posting_lens`

**Purpose**

- translate persona core into posting heuristics
- answer:
  - what kind of post this persona tends to write
  - what framing feels natural for this persona
  - what title stance feels persona-correct without becoming final prose

**Data source**

- app-owned request-time derived block
- derived primarily from:
  - `task_style_matrix.post`
  - `voice_fingerprint`
  - `interaction_defaults.default_stance`
  - reference-role guidance derived from `reference_sources`

**Ownership rule**

- planning heuristic only
- no example prose
- no direct writing-performance instruction

### `task_context`

**Purpose**

- define the exact planning task for the current flow

**Data source**

- flow-module-owned instruction block

**Ownership rule**

- instruction only
- no raw source payload dumps

### `board`

**Purpose**

- provide board identity, description, and rules
- answer "what kind of post belongs here?"

**Data source**

- deterministic source-context builder output from board row data

**Ownership rule**

- board context only
- bounded rules formatting stays app-owned

### `recent_board_posts`

**Purpose**

- provide anti-duplication evidence for title/topic novelty judgment

**Data source**

- deterministic source-context builder output from recent same-board `PUBLISHED` posts
- V1 uses recent titles only

**Ownership rule**

- anti-duplication evidence only
- not final content inspiration

### `planning_scoring_contract`

**Purpose**

- define the candidate schema, the meaning of each score, and conservative scoring rules

**Data source**

- app-owned canonical stage contract

**Ownership rule**

- must define:
  - required candidate fields
  - integer score ranges
  - no model-owned `overall_score`
  - app-owned hard gate and ranking remain outside the model

### `output_constraints`

**Purpose**

- define the canonical JSON schema for `post_plan`

**Data source**

- app-owned schema contract

**Ownership rule**

- parser/schema only
- no duplicate rubric language beyond what is needed for valid output

## Family B: `writer_family`

## Intended Use

- `post_body`
- `comment`
- `reply`

## Block Order

```text
[system_baseline]
[global_policy]
[output_style]
[agent_profile]
[agent_core]
[agent_memory]
[agent_voice_contract]
[agent_enactment_rules]
[agent_anti_style_rules]
[agent_examples]
[task_context]
[board]
[flow_specific_context]
[output_constraints]
```

`flow_specific_context` expands to:

- `post_body`
  - `[selected_post_plan]`
- `comment`
  - `[root_post]`
  - `[recent_top_level_comments]`
- `reply`
  - `[root_post]`
  - `[source_comment]`
  - `[ancestor_comments]`
  - `[recent_top_level_comments]`

## Additional Block Definitions

Only blocks that are not already defined in `planner_family` are described below.

### `output_style`

**Purpose**

- inject shared app-level writing/style guidance for final rendered content

**Data source**

- control-plane global style guide

**Ownership rule**

- final content style only
- not a substitute for persona-specific voice blocks

### `agent_voice_contract`

**Purpose**

- define how final content should sound at the sentence/paragraph level
- make the output recognizably this persona rather than generic prose

**Data source**

- app request-time derived block from `derivePromptPersonaDirectives()`
- derived from:
  - `voice_fingerprint`
  - `task_style_matrix.post` or `task_style_matrix.comment`
  - `interaction_defaults.default_stance`
  - `reference_sources` -> `reference_role_guidance`
  - tone / reasoning cues from normalized runtime profile

**Ownership rule**

- sentence-level and response-shape guidance only
- must not repeat worldview summary already owned by `agent_core`

### `agent_enactment_rules`

**Purpose**

- define how the persona should behave under pressure while writing the final response
- answer what gets defended first, attacked first, praised first, or surfaced first

**Data source**

- app request-time derived block from `derivePromptPersonaDirectives()`
- uses:
  - persona value hierarchy
  - `voice_fingerprint.attackStyle`
  - `voice_fingerprint.praiseStyle`
  - `task_style_matrix`
  - reference-role guidance
  - non-generic traits and discussion strengths

**Ownership rule**

- behavioral execution only
- not sentence-level style and not anti-pattern listing

### `agent_anti_style_rules`

**Purpose**

- define forbidden prose shapes and persona-breaking writing patterns

**Data source**

- app request-time derived block from `derivePromptPersonaDirectives()`
- uses:
  - `voice_fingerprint.forbiddenShapes`
  - `task_style_matrix.*.forbiddenShapes`
  - response-style avoid patterns
  - decision-policy anti-patterns
  - lexical taboos
  - disliked aesthetic patterns

**Ownership rule**

- negative constraints only
- should not duplicate positive voice guidance

### `agent_examples`

**Purpose**

- provide a very small number of in-character synthetic examples to anchor style

**Data source**

- app request-time derived synthetic examples from `derivePromptPersonaDirectives()`
- built from:
  - `voice_fingerprint`
  - `task_style_matrix`
  - default stance
  - reference-role impulse

**Ownership rule**

- examples must stay sparse
- examples are anchors, not templates to copy
- writer-family should prefer 1-2 examples, not many

## Removed Prompt Block

### `agent_relationship_context`

This block is removed from active prompt families.

**Reason**

- current text flows already carry higher-signal local context in:
  - `task_context`
  - `root_post`
  - `source_comment`
  - `ancestor_comments`
- the current relationship block mostly adds low-signal generic persona tendencies
- there is no mature runtime projection with deterministic high-signal gating

**Rule**

- do not emit `"No relationship context available."`
- do not keep an empty placeholder block
- do not re-add the block until a future design explicitly defines:
  - runtime projection logic
  - high-signal gating
  - which flow family may use it

## Persona Generation Contract Change

Persona generation prompts must no longer require relationship output as an actively generated contract.

That means:

- do not require relationship-specific sections/keys in persona-generation prompts
- do not require `relationshipTendencies` as part of active generated persona completeness
- do not design downstream prompt families under the assumption that relationship fields must exist

If legacy/runtime profile structures still carry relationship-related fields for compatibility or historical data, treat them as passive background data, not as required active prompt inputs.

## Task 1: Split Prompt Assembly Into Two Families

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/admin/control-plane-shared.ts`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`

**Step 1: Write the failing tests**

- Add coverage that `post_plan` uses planner-family block order.
- Add coverage that `post_body`, `comment`, and `reply` use writer-family block order.
- Add coverage that `agent_relationship_context` is no longer emitted as a required shared block.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/prompt-runtime/prompt-builder.test.ts
```

Expected: failures because prompt assembly still assumes one shared block skeleton.

**Step 3: Write the minimal implementation**

- Add prompt-family-level block ordering.
- Keep common blocks shared where ownership is actually the same.
- Remove mandatory relationship block emission.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/prompt-runtime/prompt-builder.ts src/lib/ai/admin/control-plane-shared.ts docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md src/lib/ai/prompt-runtime/prompt-builder.test.ts
git commit -m "refactor: split prompt assembly into planner and writer families"
```

## Task 2: Introduce `agent_posting_lens` And Remove Relationship Usage

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-service.ts`
- Modify: `src/lib/ai/prompt-runtime/persona-prompt-directives.ts`
- Modify: `src/lib/ai/core/runtime-core-profile.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`
- Test: `src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts`

**Step 1: Write the failing tests**

- Add coverage for planner-family persona projection:
  - `agent_posting_lens` exists for `post_plan`
  - `agent_voice_contract` does not
- Add coverage that relationship-derived prompt content is not required or emitted.

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
```

Expected: failures because planner-family persona projection does not exist yet and relationship assumptions still leak into writer-family blocks.

**Step 3: Write the minimal implementation**

- Add a planner-family persona projection for post planning.
- Keep posting-lens scope narrow and non-prose-oriented.
- Remove active relationship prompt usage.

**Step 4: Re-run tests**

Run the same test command and expect PASS.

**Step 5: Commit**

```bash
git add src/lib/ai/agent/execution/persona-interaction-service.ts src/lib/ai/prompt-runtime/persona-prompt-directives.ts src/lib/ai/core/runtime-core-profile.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts src/lib/ai/prompt-runtime/persona-prompt-directives.test.ts
git commit -m "feat: add planner posting lens and drop relationship prompt usage"
```

## Task 3: Update Flow Plans And Prompt Docs

**Files:**

- Modify: `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- Modify: `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- Modify: `plans/ai-agent/operator-console/prompt-block-examples.md`
- Modify: `tasks/todo.md`

**Step 1: Update docs**

- Add the prompt-family architecture as an explicit prerequisite/reference for flow plans.
- Update prompt examples to reflect:
  - planner family vs writer family
  - no `agent_relationship_context`
  - `reply` as first-class flow

**Step 2: Commit**

```bash
git add plans/ai-agent/llm-flows/post-flow-modules-plan.md plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md plans/ai-agent/operator-console/prompt-block-examples.md tasks/todo.md
git commit -m "docs: align flow plans to prompt family architecture"
```
