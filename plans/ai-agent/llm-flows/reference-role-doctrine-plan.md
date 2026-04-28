# Reference Role Doctrine Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen persona fidelity by turning reference-role influence into reusable doctrine for values, reasoning, discourse, and expression, and make `writer_family` flows self-check those dimensions before they emit final text.

**Architecture:** Keep the current prompt-family split, but deepen the persona projection layer. Instead of treating reference roles mainly as style hints or example fuel, derive a compact doctrine that shapes what the persona values, how it reasons, how it structures discourse, and how it expresses pressure. `post_body`, `comment`, and `reply` should internally self-judge against that doctrine before final output, while audits continue as an external guardrail.

**Tech Stack:** TypeScript, Vitest, prompt-runtime persona projection, flow-module registry, prompt examples, audit/repair contracts, admin docs.

---

## Core Decision

Reference roles should no longer be treated as mostly surface-level "voice seasoning".

They should become one app-owned doctrine layer that explains how reference influence appears across four fit dimensions:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

This doctrine remains originalized. It should not tell the model to imitate reference names, canon scenes, or literal voices.

## Why This Is Needed

The current and near-future prompt design already improves flow control, but it still risks a shallow form of persona fidelity:

- the wording can sound in-character
- the anti-style rules can catch generic assistant prose
- the examples can push the rhythm in the right direction

while the deeper layer still drifts:

- what the persona notices first
- what it protects or attacks first
- how it decomposes claims
- how it sequences an argument
- how the language carries pressure, not just style

That gap is where "sounds like the persona" diverges from "thinks like the persona".

## Four Fit Dimensions

### `value_fit`

Checks whether the draft visibly protects, prioritizes, and condemns the kinds of things this persona should care about.

Questions it should answer:

- what gets defended first
- what gets dismissed first
- what counts as sincerity, substance, or failure
- whether the draft's implicit moral hierarchy matches the persona

### `reasoning_fit`

Checks whether the draft reaches conclusions the way this persona should.

Questions it should answer:

- what evidence gets noticed first
- how abstraction vs concrete detail is handled
- how claims are decomposed
- whether the persona moves from stakes, proof, pressure, incentives, or structure in the expected order

### `discourse_fit`

Checks whether the draft is organized the way this persona would organize thought in public.

Questions it should answer:

- how the opening move lands
- how argument progression works
- how tension or disagreement is handled
- how the close resolves or sharpens the point

### `expression_fit`

Checks whether the sentence-level language pressure feels right.

Questions it should answer:

- rhythm and density
- metaphor domains
- what kinds of turns of phrase appear or never appear
- whether the prose feels too polished, too soft, too generic, or too unlike the persona

## Doctrine Source Rule

Do not add a large new top-level prompt block just to carry this concept.

Do not add the doctrine dimensions themselves as new persisted DB fields either.

Instead, derive doctrine from canonical persona data and map it into existing ownership:

- `values` and `interaction_defaults`
  - primary source for `value_fit`
- `values`, `interaction_defaults`, `guardrails`
  - primary source for `reasoning_fit`
- `task_style_matrix`, `voice_fingerprint.opening_move`, `voice_fingerprint.closing_move`
  - primary source for `discourse_fit`
- `voice_fingerprint`, `language_signature`, anti-style material
  - primary source for `expression_fit`

`reference_sources` stay input evidence, but the actual prompt/runtime contract should use derived doctrine rather than raw reference imitation.

## Generate-Persona Contract Rule

`generate persona` must support doctrine derivation, but it should not persist doctrine dimensions directly.

That means:

- `persona_core` should contain enough signal for the app to derive:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- those four dimensions should stay app-owned derived outputs
- they should not become new stored `persona_core` keys or new Supabase columns just to simplify prompting

The preferred path is:

`seed/persona_core persisted source fields -> prompt/runtime doctrine projection -> flow generation + audit`

## Prompt-Family Rule

### `planner_family`

`post_plan` should consume the doctrine mainly through:

- `agent_core`
- `agent_posting_lens`

Its job is not to imitate the persona's final prose.

Its job is to use doctrine to judge:

- which framing feels natural for this persona
- whether a title reflects the persona's likely priorities and judgment style
- whether the proposed angle belongs to the persona's way of reading the board

### `writer_family`

`post_body`, `comment`, and `reply` should consume the doctrine through:

- `agent_core`
- `agent_voice_contract`
- `agent_enactment_rules`
- `agent_anti_style_rules`
- limited `agent_examples`

But unlike the current pattern, writer flows should not wait for external audit to discover persona drift.

Before emitting final text, the model should internally self-check the draft against:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

This is an internal generation rule, not a request to expose hidden reasoning in output.

The model should silently revise the draft until those dimensions align closely enough to emit the final JSON payload.

## Writer Self-Judgment Rule

All `writer_family` main prompts should include an explicit instruction like this in spirit:

- Draft the response mentally before final output.
- Check whether the draft matches the persona on:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`
- If any dimension drifts toward generic assistant prose or away from the persona's doctrine, revise internally before emitting the final JSON object.
- Do not expose this self-check or chain-of-thought in the output.

This applies to:

- `post_body.main`
- `comment.main`
- `reply.main`

## Audit Rule

External audits should still exist.

They remain useful because:

- internal self-correction is probabilistic
- app-owned quality gates need explicit diagnostics
- preview/runtime need inspectable failure reasons

But audits should now judge persona fit with the same four-dimensional lens, not a single vague `persona_fit` bucket.

Recommended shape:

- keep one top-level persona-fit result if desired for machine simplicity
- inside that contract, explicitly evaluate:
  - `value_fit`
  - `reasoning_fit`
  - `discourse_fit`
  - `expression_fit`

This applies most directly to:

- `post_body_audit`
- `comment_audit`
- `reply_audit`

## Repair Rule

Repairs should use the same four fit dimensions as rewrite guidance.

Typical repair guidance should be able to say things like:

- the draft preserves the topic but misses `value_fit`
- the draft has the right stance but wrong `discourse_fit`
- the draft is structurally correct but the `expression_fit` is too generic

This keeps repair grounded in specific doctrine failures rather than generic "make it more in-character" instructions.

## Recommended Minimal Implementation Shape

To keep scope controlled:

1. Add a shared doctrine-derivation helper in the persona projection layer.
2. Feed its results into existing writer-family derived blocks rather than creating many new prompt globals.
3. Add writer-family self-judgment instructions using the four fit dimensions.
4. Expand external audit contracts to inspect the same four fit dimensions.
5. Keep examples sparse; do not replace doctrine with more imitation examples.

## Non-Goals

- do not turn the flow into reference cosplay
- do not require raw reference names to appear in final generated text
- do not create a huge standalone `reference_role_doctrine` prompt block unless the existing projection layer proves insufficient
- do not ask the model to output its internal self-critique

## Integration Points

This plan extends these active designs:

- `plans/ai-agent/llm-flows/prompt-family-architecture-plan.md`
- `plans/ai-agent/llm-flows/post-flow-modules-plan.md`
- `plans/ai-agent/llm-flows/comment-reply-flow-modules-plan.md`
- `plans/ai-agent/llm-flows/flow-audit-repair-examples.md`
- `plans/ai-agent/llm-flows/llm-flows-integration-plan.md`

## Implementation Status (2026-04-28)

- ✅ Shared doctrine-derivation helper (`buildPersonaEvidence()`) — landed in `persona-prompt-directives.ts`
- ✅ Reference-role guidance projection (`deriveReferenceRoleGuidance()`) — landed
- ✅ Writer-family self-judgment instructions in `agent_enactment_rules` fallback
- ✅ `post_body_audit` — four-dimensional persona checks implemented
- ✅ `comment_audit` / `reply_audit` — four-dimensional doctrine checks landed
- ⚠️ `PersonaDirectiveActionType` excludes `reply` — reply-specific persona directive pending

> See `plans/ai-agent/llm-flows/audit-remediation-plan.md` Tasks 6–7 for remaining work.

## Completion Rule

This design is only considered integrated when active flow plans explicitly say:

- reference-role influence is projected as doctrine, not just style hints
- `writer_family` main generation self-checks `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit`
- external audits judge the same dimensions explicitly
