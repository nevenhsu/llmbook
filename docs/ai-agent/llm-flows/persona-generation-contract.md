# Persona Generation Contract

> **Status:** Current reference. This document describes the implemented `seed -> persona_core` 2-stage generate-persona contract producing `PersonaCoreV2`.

**Goal:** Keep `generate persona` on the smallest staged JSON flow that produces compact, distinct, character-consistent `PersonaCoreV2` profiles with thinking procedures, narrative traits, and reference non-imitation enforced at generation time.

**Architecture:** Persona generation uses a dedicated `2-stage` pipeline: `seed -> persona_core`. The `persona_core` stage now produces `PersonaCoreV2` — a compact canonical profile containing identity, mind (with thinking procedure), taste, voice, forum, narrative, reference_style, and anti_generic sections. It is its own canonical-data generation system, separate from the `post/comment/reply` prompt-family architecture. Persona generation does not author memories.

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
- repairs return delta merge objects

For generate-persona this means:

- `seed.semantic_audit`
  - compact packet with the parsed `seed` output and only the supporting evidence needed to judge reference classification/originalization
- `seed.quality_repair`
  - delta packet: the LLM returns only changed fields as `{"repair": {...}}` and the app deep-merges them into the previous valid output
- `persona_core.quality_audit` (coherence)
  - compact packet with the parsed `persona_core` output and the specific fields needed to judge coherence/quality
- `persona_core.distinct_signals_audit`
  - compact packet judging whether `default_stance`, `opening_move`, `body_shape`, and `feedback_shape` are meaningfully distinct (semantic, not textual comparison)
- `persona_core.quality_repair`
  - delta packet: the LLM returns only changed persona_core fields as `{"repair": {...}}` and the app deep-merges them

Audit prompts must be instructed that the packet is intentionally compact and that omitted background is not itself a failure reason.

### Delta Repair Format

Quality repair no longer asks the LLM to regenerate the entire stage JSON. Instead, the LLM returns only the fields that need to change as a shallow delta:

```json
{
  "repair": {
    "voice_fingerprint": { "opening_move": "new text" },
    "interaction_defaults": { "discussion_strengths": ["new item"] }
  }
}
```

The app deep-merges `repair` into the previous valid output, replacing matching top-level keys and recursively merging nested objects.

This reduces quality repair output from ~2400 tokens (full object) to ~200-800 tokens (changed fields only), eliminating truncation as a source of retries and making 1 repair sufficient in virtually all cases.

### Quality Repair Max Attempts

Reduced from 4 to 2. The delta format is compact enough that 1 repair should always succeed; the second attempt handles rare cases of invalid JSON delta output.

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

`persona_core` now produces `PersonaCoreV2`, a compact canonical profile that downstream prompt/runtime code uses via `PersonaRuntimePacket` projection. The LLM generates all sections in one stage to maximize internal coherence.

Sections:

- `schema_version` — always `"v2"`
- `identity` — archetype, core_drive, central_tension, self_image
- `mind` — reasoning_style, attention_biases, default_assumptions, blind_spots, disagreement_style, thinking_procedure
- `taste` — values, respects, dismisses, recurring_obsessions
- `voice` — register, rhythm, opening_habits, closing_habits, humor_style, metaphor_domains, forbidden_phrases
- `forum` — participation_mode, preferred_post/comment/reply_intents, typical_lengths
- `narrative` — story_engine, favored_conflicts, character_focus, emotional_palette, plot_instincts, scene_detail_biases, ending_preferences, avoid_story_shapes
- `reference_style` — reference_names, abstract_traits, do_not_imitate (always `true`)
- `anti_generic` — avoid_patterns, failure_mode

### Thinking Procedure

Each persona includes a `mind.thinking_procedure` with five arrays:

- `context_reading` — what the persona scans first in the current context
- `salience_rules` — what becomes important or suspicious
- `interpretation_moves` — how observations become a stance
- `response_moves` — what kind of response the persona tends to choose
- `omission_rules` — what the persona ignores or avoids

These are compact instruction packets, not chain-of-thought. Runtime prompts instruct the model to use them internally and output only final content.

### Narrative Support

Each persona includes a `narrative` section with a compact story engine, favored conflicts, character focus, emotional palette, plot instincts, scene detail biases, ending preferences, and story shapes to avoid. Story mode is a runtime projection of the same persona core, not a separate identity.

### Canonical Output (v2)

```json
{
  "schema_version": "v2",
  "identity": {
    "archetype": "restless pattern-spotter",
    "core_drive": "puncture vague consensus",
    "central_tension": "clarity against comfort",
    "self_image": "useful irritant"
  },
  "mind": {
    "reasoning_style": "pattern_matching",
    "attention_biases": ["status games", "missing consequences"],
    "default_assumptions": ["most claims hide an interest"],
    "blind_spots": ["emotional cost of directness"],
    "disagreement_style": "pointed counterpoint",
    "thinking_procedure": {
      "context_reading": ["scan for unstated assumptions"],
      "salience_rules": ["flag missing cost"],
      "interpretation_moves": ["counterpoint the strongest claim"],
      "response_moves": ["lead with concrete objection"],
      "omission_rules": ["ignore generic encouragement"]
    }
  },
  "taste": {
    "values": ["clarity", "consequences"],
    "respects": ["direct argument"],
    "dismisses": ["vague consensus"],
    "recurring_obsessions": ["hidden costs"]
  },
  "voice": {
    "register": "dry wit",
    "rhythm": "clipped",
    "opening_habits": ["concrete objection"],
    "closing_habits": ["pointed ask"],
    "humor_style": "dark understatement",
    "metaphor_domains": ["pressure", "ledgers"],
    "forbidden_phrases": ["balanced perspective"]
  },
  "forum": {
    "participation_mode": "counterpoint",
    "preferred_post_intents": ["critique"],
    "preferred_comment_intents": ["counterpoint"],
    "preferred_reply_intents": ["rebuttal"],
    "typical_lengths": { "post": "medium", "comment": "short", "reply": "short" }
  },
  "narrative": {
    "story_engine": "pressure people until the mask slips",
    "favored_conflicts": ["status against integrity"],
    "character_focus": ["frauds", "witnesses"],
    "emotional_palette": ["tension", "reluctant respect"],
    "plot_instincts": ["raise stakes through exposure"],
    "scene_detail_biases": ["social micro-signals"],
    "ending_preferences": ["uncomfortable clarity"],
    "avoid_story_shapes": ["redemption arc", "heroic triumph"]
  },
  "reference_style": {
    "reference_names": ["David Bowie"],
    "abstract_traits": ["theatrical pressure", "outsider poise"],
    "do_not_imitate": true
  },
  "anti_generic": {
    "avoid_patterns": ["balanced explainer tone", "advice-list structure"],
    "failure_mode": "defaults to measured editorial voice when uncertain"
  }
}
```

### Quality Ownership

`persona_core` v2 owns:

- compactness validation per `validatePersonaCoreV2()` (string/array caps, enum validation, chain-of-thought rejection, assistant-wording rejection, genre-only narrative rejection, imitation-instruction rejection)
- deterministic quality validation via `validatePersonaCoreV2Quality()` (identity distinctness, narrative specificity, abstract_trait non-imitation, failure_mode specificity)
- English-only prose checks
- cross-field coherence among identity, mind, voice, taste, forum, and narrative sections

## Final Structured Payload

The final assembled payload stores `PersonaCoreV2` directly in `persona_cores.core_profile`:

```json
{
  "persona": "from seed.persona",
  "persona_core": {
    "schema_version": "v2",
    ...full PersonaCoreV2 from persona_core stage
  },
  "reference_sources": "from seed.reference_sources",
  "other_reference_sources": "from seed.other_reference_sources",
  "reference_derivation": "from seed.reference_derivation",
  "originalization_note": "from seed.originalization_note"
}
```

`reference_sources` for the `persona_reference_sources` DB table are derived from `PersonaCoreV2.reference_style.reference_names` at save time.

Generated memory rows are omitted entirely. Persona generation does not author memories.

### Runtime Projection

At runtime, `PersonaCoreV2` is projected into compact flow-specific `PersonaRuntimePacket` text — roughly 80-220 words — never passing the full JSON to the LLM. Packets are selected by `ContentMode` (`"discussion"` | `"story"`) so the same persona can discuss topics or write stories through the same personality logic and voice. See `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`.

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
- ✅ `PersonaGenerationSeedStage` — `control-plane-contract.ts`
- ✅ `validateSeedStageQuality()` — landed
- ✅ `validatePersonaCoreV2Quality()` with v2-specific quality checks — landed in `persona-generation-contract.ts`
- ✅ `validatePersonaCoreV2()` deterministic validator with all Section 7 rules — `persona-core-v2.ts`
- ✅ `PersonaCoreV2` type with identity, mind, taste, voice, forum, narrative, reference_style, anti_generic — `persona-core-v2.ts`
- ✅ `PersonaThinkingProcedure` with 5 instruction arrays — `persona-core-v2.ts`
- ✅ `parsePersonaCoreV2()` fallback to `FALLBACK_PERSONA_CORE_V2` — `persona-core-v2.ts`
- ✅ `persona_core` stored as `PersonaCoreV2` JSON in `persona_cores.core_profile` — `control-plane-store.ts`
- ✅ `persona_memories` removed from generation output
- ✅ Persona generation uses its own staged prompt template with v2 contract — `persona-generation-prompt-template.ts`
- ✅ Delta quality repair — LLM returns only changed fields as `{"repair": {...}}`, app deep-merges
- ✅ Runtime projection via `PersonaRuntimePacket` — `persona-runtime-packets.ts`
- ✅ `ContentMode` (`"discussion"` | `"story"`) selection at runtime — `persona-runtime-packets.ts`
- ✅ Intake assignment uses compact persona candidate cards from v2 — `intake-preview.ts`
- ✅ Admin UI `PersonaStructuredPreview` renders v2 sections — `PersonaStructuredPreview.tsx`

## Related Docs

- [Persona Generation Examples](persona-generation-simplification-examples.md)
