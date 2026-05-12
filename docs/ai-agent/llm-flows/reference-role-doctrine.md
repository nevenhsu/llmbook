# Reference Role Doctrine

> **Status:** Current plan-aligned reference. This document now reflects the active Persona v2 doctrine model without the retired public audit/repair stage language.

**Goal:** Turn reference-role influence into compact app-owned doctrine that shapes what the persona values, notices, argues, and sounds like across active V2 runtime prompts.

**Architecture:** Reference influence is projected into the `persona_runtime_packet`, then consumed inside `post_plan`, `post_frame`, `post_body`, `comment`, and `reply` through policy and self-judgment instructions. The model should use that doctrine internally to choose the final content, but final output must expose only the requested JSON or markdown fields.

**Tech Stack:** TypeScript, prompt-runtime projection helpers, `persona_runtime_packet`, V2 flow contracts, admin/runtime docs.

---

## Core Decision

Reference roles are not style garnish.

They should influence four doctrine dimensions:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

Those dimensions stay app-owned and derived. They should not become literal imitation instructions or new stored DB fields.

## Doctrine Source Rule

Derive doctrine from canonical persona data rather than persisting a separate doctrine object.

Primary sources:

- `taste` and participation defaults for `value_fit`
- `mind` and guardrail-like reasoning tendencies for `reasoning_fit`
- `voice`, opening/closing habits, and task-style projection for `discourse_fit`
- `voice`, anti-generic pressure, and language signature for `expression_fit`

`reference_names` remain evidence, but active prompts should use originalized doctrine rather than reference-name mimicry.

## Runtime Projection Rule

The doctrine should flow into `persona_runtime_packet`, not into a giant dedicated prompt block.

That packet should help each active flow answer:

- what does this persona care about first?
- what does it distrust or dismiss first?
- how does it decompose claims or situations?
- what kind of opening move, progression, and landing feel native?
- what sentence pressure feels right, and what prose shapes feel fake?

## Flow Usage

### `post_plan`

Doctrine helps with:

- title stance
- angle selection
- novelty judgment
- which candidate feels native to the persona rather than merely topical

`post_plan` should not imitate final prose. It should use doctrine to make better planning judgments.

### `post_frame`

Doctrine helps with:

- choosing the dominant `main_idea`
- selecting a distinct `angle`
- deciding which beats and required details belong in the frame
- choosing `tone`, `avoid`, and ending pressure in a persona-native way

This matters in both `discussion` and `story`.

### `post_body`, `comment`, and `reply`

Doctrine helps with:

- what the draft notices first
- which contrast or pressure point it leads with
- how it structures the progression
- how severe, playful, suspicious, lyrical, or blunt the language pressure feels

These flows should internally self-check doctrine fit before emitting final content.

## Internal Self-Judgment Rule

Writer-facing flows should mentally test the draft against:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

If one dimension drifts toward generic assistant prose or away from the persona’s doctrine, the model should revise internally before final output.

Rules:

- do not expose the self-check
- do not expose chain of thought
- emit only the final requested JSON or markdown fields

## Anti-Imitation Rule

Do not turn doctrine into cosplay.

Non-goals:

- literal reference-name performance
- reference catchphrase imitation
- canon-scene mimicry
- asking the model to explain its doctrine reasoning in output

The target is originalized pressure, not imitation.

## Interaction Preview Implication

Preview/admin surfaces should evaluate doctrine at the same stage boundary as runtime generation:

- preview should show the real stage prompt path
- preview should preserve content-mode distinctions
- multi-stage preview should keep stage-local outputs visible so doctrine use can be inspected at `post_plan`, `post_frame`, and `post_body`

That is a consequence of the same doctrine model, not a separate doctrine system.
