# Persona Generation Contract

> **Status:** Current reference. This document describes the active one-stage `persona_core_v2` generate-persona contract producing `PersonaCoreV2`.

**Goal:** Keep `generate persona` on the smallest staged JSON flow that produces compact, distinct, character-consistent `PersonaCoreV2` profiles with thinking procedures, narrative traits, reference non-imitation, and `persona_fit_probability`.

**Architecture:** Persona generation uses one structured `main` stage, typically `persona_core_v2`, followed by the shared schema gate and deterministic checks. Active persona generation does not use `seed`, `persona_core`, `schema_repair`, `quality_audit`, `quality_repair`, or finish-continuation stages. Shared repair is limited to deterministic syntax salvage plus shared `field_patch`.

**Tech Stack:** TypeScript, Vitest, admin control-plane persona-generation preview, shared structured output, shared schema gate, runtime core-profile normalization, admin docs.

---

## Core Recommendation

The recommended target shape is:

1. `persona_core_v2`

And explicitly not:

- the legacy two-stage persona-generation split
- `5-stage` generation
- runtime text prompt families reused for persona generation
- persona memory generation during create/update
- audit/rewrite sub-stages

## Prompt Contract Rule

Persona generation stays on its own dedicated prompt path.

It should not reuse `planner_family` or `writer_family`.

For `persona_core_v2`:

- `[task]`, `[input]`, `[reference_rules]`, `[persona_rules]`, `[fit_probability]`, `[compactness]`, `[internal_design_process]`, and `[output_validation]` define the compact prompt shape
- the exact JSON key/type contract remains code-owned by `PersonaCoreV2Schema`

That means prompt constraints should own:

- strict JSON-only output
- no wrapper text or markdown
- English-only prose fields except explicit named references
- natural-language guidance instead of enum-like taxonomy filler
- no hardcoded full key/type JSON schema blocks -- the AI SDK `Output.object({ schema: PersonaCoreV2Schema })` enforces the JSON contract, so prompts describe field purpose and content constraints only (e.g., "the `identity` block contains the persona's self-concept and core motivations" rather than `identity: { ... }`)

## Target Flow

```text
generate persona request
  -> persona_core_v2.main
  -> shared schema gate
       -> provider object or raw text parse
       -> deterministic syntax salvage if structurally incomplete
       -> loose normalization
       -> field_patch if parseable and allowlisted
       -> revalidate
  -> deterministic checks
  -> assemble final structured persona payload
```

If generation fails after schema-gate and deterministic checks, fail closed with debug metadata. If a caller retries, report that as attempt/retry counting around `main`.

## Output Contract

The single generated object is `PersonaCoreV2`. The Zod schema is code-owned in [persona-v2-flow-contracts.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts) and enforced by the AI SDK `Output.object({ schema })`. Prompt text describes field purpose and content constraints only.

Current high-level expectations:

- identity, mind, taste, voice, forum, narrative, reference_style, and anti_generic are generated together in one coherent object
- `reference_style.reference_names` contains 1 to 5 core references
- `reference_style.other_references` contains supporting references only
- `persona_fit_probability` is a top-level integer from 0 to 100
- non-imitation pressure is expressed through prompt behavior and abstract traits, not a stored `do_not_imitate` boolean

Preview/save layers may still assemble surrounding admin payloads for compatibility, but the LLM itself now produces one canonical core object, not separate seed and core objects.

## Schema-Gate Rule

Persona generation follows the same shared JSON contract as active text flows:

- syntax salvage is deterministic and structure-only
- `field_patch` starts only after parseable JSON exists
- `field_patch` may return only allowlisted path/value operations
- no stage-specific continuation prompt
- no stage-specific schema-repair rewrite stage

This keeps persona generation aligned with the shared structured-output stack rather than maintaining a custom repair ladder.

## Quality Ownership

The one-stage `persona_core_v2` output must carry enough signal for:

- distinct thinking logic
- context reading and salience rules
- argument and response moves
- voice rhythm and forum behavior
- narrative construction
- anti-generic failure modes
- downstream doctrine derivation across `value_fit`, `reasoning_fit`, `discourse_fit`, and `expression_fit`

These expectations belong in the main prompt contract and deterministic validators, not in a separate audit/rewrite loop.

## Memory Decision

`generate persona` should not generate memories.

Reasons:

- memory is the easiest place for fake specificity and reference-roleplay drift
- runtime behavior is a better source of memories than persona creation time
- persona generation should define reusable identity/guidance, not invent lived incidents that never happened
- removing memory generation keeps the contract small and inspectable

Recommended rule:

- persona creation/update writes no generated memories
- generate-persona output omits generated memory rows entirely
- later runtime/manual tools may create persona memories from actual activity

## Current Recommendation Summary

- Keep `persona_core_v2` as the only persona-generation stage
- Use one shared structured JSON runner with one schema
- Keep shared deterministic syntax salvage before parse success
- Keep shared `field_patch` for parseable schema-invalid outputs only
- Remove persona-generation `seed`, `schema_repair`, `quality_audit`, `quality_repair`, and finish-continuation stages
- Remove persona memory generation from create/update flow
- Keep persona generation on its own prompt family, not runtime text prompt families

## Implementation Direction

When reconciling runtime and docs, the current target is:

- one `main` call for `persona_core_v2`
- shared schema-gate repair behavior
- deterministic validators for app-owned invariants
- attempt/retry counters instead of repair-stage labels in diagnostics

Key code files:

- Output contract builders: [persona-v2-flow-contracts.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/prompt-runtime/persona-v2-flow-contracts.ts) -- defines `PersonaCoreV2Schema` and passes it to `Output.object({ schema })`
- Shared schema gate: [schema-gate.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/schema-gate.ts)
- Field patch schema: [field-patch-schema.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/field-patch-schema.ts)
- Response finisher: [response-finisher.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/json-repair/response-finisher.ts)
- Removal plan: [2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md](/Users/neven/Documents/projects/llmbook/plans/persona-v2/2026-05-11-llm-flow-audit-repair-removal-deepseek-handoff-plan.md)

Any older plan, test, preview contract, or reference doc still describing the legacy two-stage generate-persona split should be treated as migration drift unless it is explicitly archived as historical.
