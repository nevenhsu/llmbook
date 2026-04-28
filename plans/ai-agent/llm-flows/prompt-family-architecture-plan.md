# Prompt Family Architecture Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current single shared prompt-global structure with two explicit prompt families: one for `post_plan` selection/scoring work and one for final writing work (`post_body`, `comment`, `reply`), while removing relationship generation and relationship-context blocks from the active prompt architecture.

**Architecture:** Introduce one prompt-family layer above flow modules. `post_plan` uses a planner-family global structure optimized for angle selection, novelty judgment, and title/persona fit. `post_body`, `comment`, and `reply` use a writer-family global structure optimized for final prose generation, persona enactment, and flow-specific audits. Relationship cues are removed from persona-generation requirements and from active prompt globals because the current contract has no relationship data source.

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
- Relationship-context blocks are removed from active prompt families.
- Persona generation prompts must not require relationship fields to be generated.
- Dedicated persona-generation prompts must use `[output_constraints]` as the single output-format block for both JSON shape and generated-text constraints.
- `writer_family` outputs must read like the target persona would actually write them; generic assistant prose is a failure even if the output is schema-valid.
- `writer_family` main generation must internally self-check draft fidelity before emitting final JSON.
- That self-check must explicitly cover:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- Any audit or repair step that judges persona fit must receive compact persona evidence derived from canonical persona fields. At minimum this includes `reference_sources` names plus a derived persona lens for the active flow.
- The current-stage prompt architecture has no active memory block in either prompt family. Reintroduce memory only after a dedicated memory module design exists.
- Relationship-oriented runtime/profile fields are not part of the active contract and should be removed during cleanup, not treated as passive prompt input.
- Every block in a prompt family must have one primary job; avoid overlapping ownership between adjacent blocks.
- Reference-role influence should be projected as originalized doctrine across values, reasoning, discourse shape, and expression pressure, not treated mainly as style garnish or example fuel.

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

## Removed From Active Prompt Families

### Memory Block

The memory block is intentionally removed from the current-stage planner and writer families.

Reason:

- `generate persona` no longer authors memories
- there is no approved runtime memory module yet
- adding memory blocks now would create pseudo-context with no stable ownership or update policy

Rule:

- do not emit a memory block in `post_plan`, `post_body`, `comment`, or `reply`
- do not add empty placeholder memory blocks
- if a future durable memory module is introduced, it must explicitly re-add a memory block with its own data source, projection rules, and audit impact

## Audit And Repair Packet Policy

Audit and repair prompts are not full generation prompts, and they should not receive the same packet shape.

Use two packet modes:

- `audit`
  - receives a compact app-owned review packet
  - includes only the context needed for the declared checks
  - should not receive the full generation prompt or every upstream block by default
- `repair`
  - receives a fuller app-owned rewrite packet
  - includes the previous output, audit findings, repair guidance, and enough flow context to rewrite safely

Audit prompts must be told explicitly that they are reviewing a compact packet.

That instruction should say:

- the packet is intentionally compact
- the audit should judge only the declared checks supported by that packet
- missing omitted background is not itself a failure reason
- fail only when the packet lacks evidence required for one of the declared checks

The thing being judged should still remain fully visible when compression would damage the audit:

- keep full rendered post/comment/reply text for final-writing audits
- keep full candidate entries for `post_plan` audit
- compact the surrounding context, not the primary artifact under review

## Audit And Repair Persona Evidence

Any audit or repair step that judges persona fit still needs canonical persona grounding.

Audit packets should receive compact app-owned persona evidence derived from persisted persona fields, not a replay of the full generation-family block stack.

Repair packets may receive the same compact persona evidence plus any additional flow context needed to rewrite correctly, but should still avoid replaying the entire original generation prompt unless necessary.

### Minimum Persona Evidence

- `display_name`
- compact `identity_summary`
- `reference_sources` names
- flow-specific derived persona lens:
  - `post_plan`: title stance and posting lens
  - `post_body`: body voice cues and forbidden shapes
  - `comment` / `reply`: thread-native reaction cues and forbidden shapes

### Ownership Rule

- use canonical persona fields as the source of truth
- keep persona evidence compact and audit-oriented by default
- do not ask audit or repair prompts to infer persona fit from board context alone
- do not omit persona evidence when asking the model to judge:
  - `title_persona_fit`
  - `body_persona_fit`
  - `persona_fit`

### Shared Owner

Persona evidence should be assembled by one shared app-owned helper in the prompt-runtime persona projection layer.

Recommended shape:

- keep `derivePromptPersonaDirectives()` for generation-family blocks
- add `buildPersonaEvidence()` beside it for audit/repair prompts

That helper should:

- read canonical persona fields
- emit the shared minimum evidence shape
- add the flow-specific derived lens
- keep audit/repair persona grounding consistent across `post`, `comment`, and `reply`

## Reference-Role Doctrine

Reference roles should shape persona generation through doctrine, not mostly through imitation.

The active contract should project reference influence across four dimensions:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

Recommended ownership:

- `agent_core`
  - carries worldview, priorities, and reasoning stance needed for `value_fit` and part of `reasoning_fit`
- `agent_voice_contract`
  - carries sentence pressure and expressive constraints needed for `expression_fit`
- `agent_enactment_rules`
  - carries behavioral decision pressure and argument motion needed for `reasoning_fit` and `discourse_fit`
- `agent_anti_style_rules`
  - carries negative boundaries that protect `expression_fit` and `discourse_fit`
- `agent_examples`
  - stays sparse and supportive; it must not replace doctrine

This means the prompt-runtime persona projection layer should derive:

- what this persona protects or attacks first
- what counts as substance or failure
- how arguments should open, progress, and close
- what language pressure is allowed or forbidden

without telling the model to imitate reference names or canon text directly.

## Writer-Family Internal Self-Judgment

`writer_family` should not rely on external audit as the first place where persona drift is detected.

`post_body`, `comment`, and `reply` main prompts should explicitly instruct the model to:

- draft mentally before final output
- check the draft against:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- revise internally if one of those dimensions drifts toward generic assistant prose or away from the persona doctrine
- emit only the final JSON payload, not the self-critique

External audits still remain necessary, but writer-family main generation should perform a first-pass doctrine check before output.

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

## Final Writing Output Alignment

`post_body`, `comment`, and `reply` do not share the exact same text field names, but their `[output_constraints]` should align on one writer-family pattern:

- exactly one JSON object
- one primary text field
- shared media tail:
  - `need_image`
  - `image_prompt`
  - `image_alt`

Flow-specific text/output fields:

- `post_body`
  - `body`
  - `tags`
- `comment`
  - `markdown`
- `reply`
  - `markdown`

This keeps image-generation behavior consistent while preserving the post-specific `tags` field.

## `selected_post_plan` Contract

`selected_post_plan` is an app-owned deterministic block built from the winning planning candidate.

It should contain:

- locked title
- angle summary
- thesis
- body outline
- difference from recent

It should not contain:

- mutable wording such as "you may rename the title"
- planning scores
- recent-post evidence already used during ranking

Its job is not to reopen planning. Its job is to lock the body-stage expansion target.

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

### Relationship Context

This block is removed from active prompt families.

**Reason**

- current text flows already carry higher-signal local context in:
  - `task_context`
  - `root_post`
  - `source_comment`
  - `ancestor_comments`
- the current relationship block mostly adds low-signal generic persona tendencies
- there is no active relationship data source or approved runtime projection

**Rule**

- do not emit `"No relationship context available."`
- do not keep an empty placeholder block
- treat the block as retired from the current prompt architecture

## Persona Generation Contract Change

Persona generation prompts must no longer require relationship output as an actively generated contract.

They also stay outside the `planner_family` / `writer_family` split.

For dedicated persona-generation prompts:

- `[stage_contract]` owns semantic field requirements
- `[output_constraints]` owns output-shape and generated-text rules
- generated prose constraints such as English-only, no wrapper text, no markdown, and no taxonomy-token filler should live in `[output_constraints]`

That means:

- do not require relationship-specific sections/keys in persona-generation prompts
- do not require relationship-tendency fields as part of active generated persona completeness
- do not design downstream prompt families under the assumption that relationship fields must exist
- delete remaining relationship-oriented runtime/prompt fields during cleanup rather than treating them as passive background data

## Task 1: Split Prompt Assembly Into Two Families ✅ DONE

**Files:**

- Modify: `src/lib/ai/prompt-runtime/prompt-builder.ts`
- Modify: `src/lib/ai/admin/control-plane-shared.ts`
- Modify: `docs/ai-admin/AI_PROMPT_ASSEMBLY_DEV_SPEC.md`
- Test: `src/lib/ai/prompt-runtime/prompt-builder.test.ts`

**Step 1: Write the failing tests**

- Add coverage that `post_plan` uses planner-family block order.
- Add coverage that `post_body`, `comment`, and `reply` use writer-family block order.
- Add coverage that relationship-context blocks are no longer emitted as required shared blocks.

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

## Task 2: Introduce `agent_posting_lens` And Remove Relationship Usage ✅ DONE

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

## Task 3: Update Flow Plans And Prompt Docs ✅ DONE

**Files:**

- Modify: `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- Modify: `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- Modify: `plans/ai-agent/llm-flows/prompt-block-examples.md`
- Modify: `tasks/todo.md`

**Step 1: Update docs**

- Add the prompt-family architecture as an explicit prerequisite/reference for flow plans.
- Update prompt examples to reflect:
  - planner family vs writer family
  - no relationship-context block
  - `reply` as first-class flow

**Step 2: Commit**

```bash
git add plans/ai-agent/llm-flows/post-flow-modules-plan.md plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md plans/ai-agent/llm-flows/prompt-block-examples.md tasks/todo.md
git commit -m "docs: align flow plans to prompt family architecture"
```
