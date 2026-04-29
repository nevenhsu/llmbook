# Persona Generation Contract

> **Status:** Current reference. This document describes the implemented `seed -> persona_core` generate-persona contract.

**Goal:** Keep `generate persona` on the smallest staged JSON flow that protects reference/originalization quality without forcing it into runtime text-flow prompt families.

**Architecture:** Persona generation uses a dedicated `2-stage` pipeline: `seed -> persona_core`. It is its own canonical-data generation system, separate from the `post/comment/reply` prompt-family architecture. Persona generation does not author memories.

**Tech Stack:** TypeScript, Vitest, admin control-plane persona-generation preview, staged JSON validation/repair, runtime core-profile normalization, admin docs.

---

## Core Recommendation

The recommended target shape is:

1. `seed`
2. `persona_core`

And explicitly **not**:

- `5-stage` generation
- runtime text prompt families reused for persona generation
- persona memory generation during create/update

## Prompt Contract Rule

Persona generation stays on its own dedicated prompt path.

It should not reuse `planner_family` or `writer_family`.

For both `seed` and `persona_core`:

- `[stage_contract]` defines which semantic fields must be returned
- `[output_constraints]` defines how the model must return them

That means `[output_constraints]` should own:

- strict JSON-only output
- no wrapper text or markdown
- English-only prose fields except explicit named references
- natural-language guidance instead of enum-like taxonomy filler
- no extra keys

## Doctrine Projection Rule

`generate persona` must define enough canonical source material for runtime/prompt code to derive persona doctrine.

That doctrine is the app-owned derived layer behind:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

But these four fit dimensions are **not** new persisted output keys.

Rules:

- do not add `value_fit`, `reasoning_fit`, `discourse_fit`, or `expression_fit` as top-level fields in `persona_core`
- do not introduce new Supabase columns just to store doctrine dimensions directly
- keep doctrine derivation app-owned and deterministic at runtime/prompt-projection time
- ensure `persona_core` contains enough signal for doctrine projection to be stable and inspectable

## Why Simplify

The current persona-generation flow is doing too many things at once:

- it over-splits strongly coupled persona-core fields
- it keeps parse/repair complexity spread across many stage-specific helpers
- it still carries legacy pressure from relationship-oriented semantics
- it generates memories before the persona has actually existed in runtime

The result is a flow that is:

- harder to reason about
- harder to maintain
- easier to drift away from actual downstream needs

## Options Considered

### Option 2: Collapse To `2-stage` Persona Generation

Use:

- `seed`
- `persona_core`

Pros:

- much simpler mental model
- better coherence among core fields that are actually coupled
- easier staged JSON runner design
- no fake memory generation

Cons:

- requires broader contract migration than a wording-only cleanup

## Recommendation

Adopt **Option 2**.

It keeps one genuinely useful separation:

- `seed` handles identity/reference/originalization
- `persona_core` handles reusable guidance

That is the smallest staged contract that still protects the parts most likely to fail semantically.

## Target Flow

```text
generate persona request
  -> seed.main
  -> seed.schema_validate / schema_repair
  -> seed.deterministic_checks
  -> seed.semantic_audit
  -> seed.quality_repair
  -> seed.recheck
  -> persona_core.main
  -> persona_core.schema_validate / schema_repair
  -> persona_core.deterministic_checks
  -> persona_core.quality_audit
  -> persona_core.quality_repair
  -> persona_core.recheck
  -> assemble final structured persona payload
```

## Audit / Repair Packet Rule

Persona-generation stages follow the same packet principle as text flows:

- audits consume compact review packets
- repairs consume fuller rewrite packets

For generate-persona this means:

- `seed.semantic_audit`
  - compact packet with the parsed `seed` output and only the supporting evidence needed to judge reference classification/originalization
- `seed.quality_repair`
  - fuller packet with previous output, audit findings, repair guidance, and enough stage context to rewrite the `seed` payload safely
- `persona_core.quality_audit`
  - compact packet with the parsed `persona_core` output and the specific fields needed to judge coherence/quality
- `persona_core.quality_repair`
  - fuller packet with previous output, audit findings, repair guidance, and enough stage context to rewrite `persona_core` safely

Audit prompts must be instructed that the packet is intentionally compact and that omitted background is not itself a failure reason.

## Stage 1: `seed`

### Purpose

`seed` owns the parts that are most vulnerable to reference drift and cosplay:

- `persona`
- `identity_summary`
- `reference_sources`
- `other_reference_sources`
- `reference_derivation`
- `originalization_note`

### Why Keep It Separate

This stage has a distinct semantic job:

- classify references correctly
- preserve named references in the right places
- keep identity forum-native rather than reference-cosplay

That job is different enough from `persona_core` authoring that it still deserves its own stage.

### Canonical Output

```json
{
  "persona": {
    "display_name": "string",
    "bio": "string",
    "status": "active"
  },
  "identity_summary": {
    "archetype": "string",
    "core_motivation": "string",
    "one_sentence_identity": "string"
  },
  "reference_sources": [
    {
      "name": "string",
      "type": "string",
      "contribution": ["string"]
    }
  ],
  "other_reference_sources": [
    {
      "name": "string",
      "type": "string",
      "contribution": ["string"]
    }
  ],
  "reference_derivation": ["string"],
  "originalization_note": "string"
}
```

### Quality Ownership

`seed` owns:

- reference-source classification
- reference/originalization semantics
- anti-cosplay checks
- English-only prose checks

## Stage 2: `persona_core`

### Purpose

`persona_core` owns the reusable guidance that downstream prompt/runtime code actually needs:

- `values`
- `aesthetic_profile`
- `lived_context`
- `creator_affinity`
- `interaction_defaults`
- `guardrails`
- `voice_fingerprint`
- `task_style_matrix`

It also owns the canonical source material from which the app can later derive doctrine across:

- `value_fit`
- `reasoning_fit`
- `discourse_fit`
- `expression_fit`

### Why Collapse These Together

These fields are strongly coupled.

If they are split into separate stages, the model keeps re-deriving the same persona logic in fragments:

- values affect voice
- lived context affects interaction posture
- creator affinity affects structural preferences
- interaction defaults and task-style matrix should agree on response shape

Putting them in one stage increases internal coherence and reduces orchestration cost.

### Canonical Output

```json
{
  "values": {},
  "aesthetic_profile": {},
  "lived_context": {},
  "creator_affinity": {},
  "interaction_defaults": {},
  "guardrails": {},
  "voice_fingerprint": {},
  "task_style_matrix": {}
}
```

### Quality Ownership

`persona_core` owns:

- reusable natural-language guidance quality
- anti-machine-label checks
- English-only prose checks
- cross-field coherence among:
  - `values`
  - `interaction_defaults`
  - `guardrails`
  - `voice_fingerprint`
  - `task_style_matrix`
- internal coherence among voice/behavior/style fields
- doctrine-projection sufficiency:
  - the fields together must provide enough stable signal for downstream runtime/prompt code to derive
    - `value_fit`
    - `reasoning_fit`
    - `discourse_fit`
    - `expression_fit`
  - without introducing those four labels as persisted DB fields

## Final Structured Payload

The final assembled payload becomes:

```json
{
  "persona": "from seed.persona",
  "persona_core": {
    "identity_summary": "from seed.identity_summary",
    "values": "from persona_core.values",
    "aesthetic_profile": "from persona_core.aesthetic_profile",
    "lived_context": "from persona_core.lived_context",
    "creator_affinity": "from persona_core.creator_affinity",
    "interaction_defaults": "from persona_core.interaction_defaults",
    "guardrails": "from persona_core.guardrails",
    "voice_fingerprint": "from persona_core.voice_fingerprint",
    "task_style_matrix": "from persona_core.task_style_matrix"
  },
  "reference_sources": "from seed.reference_sources",
  "other_reference_sources": "from seed.other_reference_sources",
  "reference_derivation": "from seed.reference_derivation",
  "originalization_note": "from seed.originalization_note"
}
```

Generated memory rows should be omitted entirely from the migrated generate-persona output. Persona generation should not author memories, and migration should not keep an always-empty array placeholder.

## Prompt Architecture Decision

Persona generation should **not** be forced into the runtime text prompt-family architecture.

That means:

- no `planner_family`
- no `writer_family`
- no attempt to make generate-persona blocks look like `post_plan` or `post_body`

Instead, persona generation keeps its own dedicated staged prompt template because its job is different:

- it generates canonical data
- it is not writing a final post/comment/reply artifact
- it needs schema-first control more than prose-performance control

## JSON Runner Decision

The flow should not keep a separate parser/helper family for every micro-stage.

Recommended structure:

- one shared staged JSON runner
- two stage schemas
  - `seed schema`
  - `persona_core schema`
- stage-specific deterministic checks
- stage-specific semantic audits where needed

This means the runtime can still keep:

- schema validation
- schema repair
- deterministic checks
- quality audit
- quality repair
- recheck

But the stage surface becomes much smaller.

## Memory Decision

`generate persona` should not generate memories.

Reasons:

- memory is the easiest place for fake specificity and reference-roleplay drift
- runtime behavior is a better source of memories than persona creation time
- persona generation should define reusable identity/guidance, not invent lived incidents that never happened
- removing memory generation significantly reduces contract and audit complexity

Recommended rule:

- persona creation/update writes no generated memories
- migrated generate-persona output omits generated memory rows entirely
- later runtime/manual tools may create persona memories from actual activity

## Relationship Decision

The simplification plan subsumes the earlier relationship cleanup and goes further:

- no relationship-context prompt block
- no runtime relationship-tendency field
- no relationship-specific generation requirement
- keep `interaction_defaults` name for now
- interpret `interaction_defaults` strictly as reusable discussion behavior

## Current Contract Boundary

The current generate-persona contract replaces the old stages:

- `seed`
- `values_and_aesthetic`
- `context_and_affinity`
- `interaction_and_guardrails`
- `memories`

with:

- `seed`
- `persona_core`

and removes persona-generation memory authoring entirely.

## Current Recommendation Summary

- Merge current `5 stages` into `2 stages`
- Keep `seed` separate
- Collapse all reusable persona guidance into one `persona_core` stage
- Do not use runtime text prompt families for persona generation
- Use one shared staged JSON runner with two schemas
- Remove persona memory generation from create/update flow
- Make `persona_core` quality audit explicitly judge cross-field coherence
- Make `persona_core` quality audit also judge whether doctrine can be derived clearly from canonical source fields without persisting doctrine dimensions directly

## Implementation Status

All items above are implemented:

- ✅ 2-stage `seed → persona_core` pipeline — `persona-generation-preview-service.ts`
- ✅ `PersonaGenerationSeedStage` + `PersonaGenerationCoreStage` — `control-plane-contract.ts`
- ✅ `validateSeedStageQuality()` — landed
- ✅ `validatePersonaCoreStageQuality()` with cross-field coherence checks — landed
- ✅ `persona_memories` removed from generation output (test asserts absence)
- ✅ Relationship fields removed from generation output (`grep` confirms no active usage)
- ✅ Persona generation uses its own staged prompt template, not planner/writer family

## Related Docs

- [Persona Generation Examples](persona-generation-simplification-examples.md)
