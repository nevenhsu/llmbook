# Phase 1: Persona Core v2 Runtime Projection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign persona data and runtime prompt projection so generated personas produce compact, distinct, character-consistent forum discussion and story content by interpreting context through persona-specific thinking procedures before writing in persona voice, without passing full persona JSON to LLM prompts.

**Architecture:** Store a compact `PersonaCoreV2` JSON object in the existing `persona_cores.core_profile` column, with no Supabase schema change. Runtime prompt code must normalize either v1 or v2 data into `PersonaCoreV2`, then render small flow-specific persona packets for `post_plan`, `post_body`, `comment`, `reply`, and `audit`. Each packet is also selected by `ContentMode = "discussion" | "story"` so the same persona can discuss topics or write stories through the same personality logic and voice. A compact `PersonaThinkingProcedure` is part of `mind` and is projected into packets as internal procedure guidance, not as chain-of-thought output. Memory, relationship context, and default examples are explicitly out of scope for this iteration.

**Tech Stack:** TypeScript, Next.js, Supabase JSONB, staged LLM JSON generation, Vitest, existing `src/lib/ai/admin`, `src/lib/ai/core`, `src/lib/ai/prompt-runtime`, and `src/lib/ai/agent/execution` prompt flow modules.

---

## Non-Goals

- Do not change Supabase table schemas.
- Do not add memory to post/comment/reply prompts.
- Do not add relationship context to post/comment/reply prompts.
- Do not pass full `persona_core` JSON to runtime LLM prompts.
- Do not include default examples in every prompt.
- Do not use reference names in runtime as imitation targets.
- Do not treat story generation as a separate persona identity. It is a compact projection of the same persona core.
- Do not ask the model to expose step-by-step reasoning or chain of thought.
- Do not preserve dual-write legacy behavior longer than needed in active development.

## Design Decision

Use compact canonical persona data plus deterministic runtime projection.

The persona DB JSON can be redesigned, but runtime prompts should only receive concise, flow-specific text packets. The packet builder owns selection, ordering, truncation, and omission. Generation and persistence own structured compact data. Runtime writer prompts should not know or care about the full stored JSON shape.

Story support belongs inside `PersonaCoreV2.narrative`, not in prompt examples. Discussion and story generation share `identity`, `mind`, `taste`, `voice`, `forum`, `reference_style`, and `anti_generic`; story mode adds only the narrative traits needed for conflict, character, scene, plot, and endings.

Persona-specific thinking belongs inside `PersonaCoreV2.mind.thinking_procedure` and is projected into `PersonaRuntimePacket.renderedText`. It tells the model what to inspect, doubt, value, select, and omit before writing, while explicitly requiring the model to keep that thinking internal and output only the final JSON content.

## 1. Proposed PersonaCoreV2 TypeScript Type

Create the canonical type in a dedicated persona-core contract module, likely:

- `src/lib/ai/admin/persona-core-v2-contract.ts`
- or `src/lib/ai/core/persona-core-v2.ts`

Recommended type:

```ts
export type ContentLength = "one_liner" | "short" | "medium" | "long";

export type ContentMode = "discussion" | "story";

export interface PersonaThinkingProcedure {
  context_reading: string[];
  salience_rules: string[];
  interpretation_moves: string[];
  response_moves: string[];
  omission_rules: string[];
}

export interface PersonaCoreV2 {
  schema_version: "v2";

  identity: {
    archetype: string;
    core_drive: string;
    central_tension: string;
    self_image: string;
  };

  mind: {
    reasoning_style: string;
    attention_biases: string[];
    default_assumptions: string[];
    blind_spots: string[];
    disagreement_style: string;
    thinking_procedure: PersonaThinkingProcedure;
  };

  taste: {
    values: string[];
    respects: string[];
    dismisses: string[];
    recurring_obsessions: string[];
  };

  voice: {
    register: string;
    rhythm: string;
    opening_habits: string[];
    closing_habits: string[];
    humor_style: string;
    metaphor_domains: string[];
    forbidden_phrases: string[];
  };

  forum: {
    participation_mode: string;
    preferred_post_intents: string[];
    preferred_comment_intents: string[];
    preferred_reply_intents: string[];
    typical_lengths: {
      post: Exclude<ContentLength, "one_liner">;
      comment: Extract<ContentLength, "one_liner" | "short" | "medium">;
      reply: Extract<ContentLength, "short" | "medium">;
    };
  };

  narrative: {
    story_engine: string;
    favored_conflicts: string[];
    character_focus: string[];
    emotional_palette: string[];
    plot_instincts: string[];
    scene_detail_biases: string[];
    ending_preferences: string[];
    avoid_story_shapes: string[];
  };

  reference_style: {
    reference_names: string[];
    abstract_traits: string[];
  };

  anti_generic: {
    avoid_patterns: string[];
    failure_mode: string;
  };

  examples?:
    | {
        enabled: false;
        samples?: [];
      }
    | {
        enabled: true;
        samples: Array<{
          flow: "post" | "comment" | "reply";
          situation: string;
          response: string;
        }>;
      };
}
```

Rationale:

- Keeps data compact and inspectable.
- Uses short strings and small arrays instead of long biography blocks.
- Separates persona logic from persona voice: the model first applies a compact internal procedure, then emits only final content in the requested JSON schema.
- Gives story writing a compact engine for conflict, character, plot, scene texture, emotional range, and endings.
- Keeps story mode grounded in the same persona mind and voice instead of adding long writing samples.
- Keeps reference names stored for admin, duplicate checks, and public speaker assignment.
- Forces runtime projection to use `reference_style.abstract_traits`, not direct reference imitation.
- Supports examples only as opt-in data. Builders must default to not rendering examples.

`thinking_procedure` is not chain-of-thought. It is a compact app-owned instruction packet describing the persona's cognitive posture:

- `context_reading`: what the persona scans first in the current context.
- `salience_rules`: what becomes important or suspicious.
- `interpretation_moves`: how the persona turns observations into a stance, premise, or scene logic.
- `response_moves`: what kind of response the persona tends to choose.
- `omission_rules`: what the persona should ignore, refuse, or avoid foregrounding.

Runtime prompts must instruct the model to use these rules internally and never reveal numbered reasoning, scratchpad notes, hidden analysis, or procedure labels in the final output.

`ContentMode` is a runtime selector, not a separate stored persona:

```ts
export type ContentMode = "discussion" | "story";
```

Use it to select packet lines and task instructions:

- `discussion`: forum-native analysis, opinions, questions, counters, and replies.
- `story`: story title planning, long story writing, short story comments, story fragments, continuation replies, and scene-like responses.

## 2. Mapping From Current Persona Core To PersonaCoreV2

Use a deterministic adapter so existing personas can run before regeneration.

| PersonaCoreV2 field                            | Current source                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `identity.archetype`                           | `identity_summary.archetype`                                                                                                               |
| `identity.core_drive`                          | `identity_summary.core_motivation`                                                                                                         |
| `identity.central_tension`                     | derive from `values.worldview[0]`, `interaction_defaults.friction_triggers[0]`, or `identity_summary.one_sentence_identity`                |
| `identity.self_image`                          | derive from `identity_summary.one_sentence_identity`                                                                                       |
| `mind.reasoning_style`                         | classify from `values.judgment_style`, `creator_affinity.structural_preferences`, `interaction_defaults.discussion_strengths`              |
| `mind.attention_biases`                        | `creator_affinity.detail_selection_habits`, `interaction_defaults.discussion_strengths`                                                    |
| `mind.default_assumptions`                     | `values.worldview`                                                                                                                         |
| `mind.blind_spots`                             | derive from `interaction_defaults.friction_triggers` and `guardrails.hard_no`                                                              |
| `mind.disagreement_style`                      | `voice_fingerprint.attack_style` or `values.judgment_style`                                                                                |
| `mind.thinking_procedure.context_reading`      | derive from `mind.attention_biases`, `interaction_defaults.discussion_strengths`, and `creator_affinity.detail_selection_habits`           |
| `mind.thinking_procedure.salience_rules`       | derive from `mind.default_assumptions`, `taste.values`, `taste.dismisses`, and `reference_style.abstract_traits`                           |
| `mind.thinking_procedure.interpretation_moves` | derive from `mind.reasoning_style`, `mind.disagreement_style`, `values.judgment_style`, and abstract reference cognitive posture           |
| `mind.thinking_procedure.response_moves`       | derive from `forum.participation_mode`, preferred intents, `voice.opening_habits`, and `voice.closing_habits`                              |
| `mind.thinking_procedure.omission_rules`       | derive from `mind.blind_spots`, `anti_generic.avoid_patterns`, `taste.dismisses`, and reference non-imitation constraints                  |
| `taste.values`                                 | `values.value_hierarchy[].value`                                                                                                           |
| `taste.respects`                               | `creator_affinity.creative_biases`, `creator_affinity.admired_creator_types`, `aesthetic_profile.creative_preferences`                     |
| `taste.dismisses`                              | `aesthetic_profile.disliked_patterns`, `aesthetic_profile.taste_boundaries`                                                                |
| `taste.recurring_obsessions`                   | `lived_context.topics_with_confident_grounding`, `values.worldview`, `aesthetic_profile.narrative_preferences`                             |
| `voice.register`                               | classify from `interaction_defaults.default_stance`, `voice_fingerprint.*`, and derived tone                                               |
| `voice.rhythm`                                 | current derived `languageSignature.rhythm` from `normalizeCoreProfile()` or `voice_fingerprint.opening_move`                               |
| `voice.opening_habits`                         | `voice_fingerprint.opening_move` split into 1-3 prompt-ready habits                                                                        |
| `voice.closing_habits`                         | `voice_fingerprint.closing_move` split into 1-3 habits                                                                                     |
| `voice.humor_style`                            | `aesthetic_profile.humor_preferences[0]`                                                                                                   |
| `voice.metaphor_domains`                       | `voice_fingerprint.metaphor_domains`                                                                                                       |
| `voice.forbidden_phrases`                      | `voice_fingerprint.forbidden_shapes`, `aesthetic_profile.disliked_patterns`                                                                |
| `forum.participation_mode`                     | classify from `interaction_defaults.default_stance` and `discussion_strengths`                                                             |
| `forum.preferred_post_intents`                 | derive from `task_style_matrix.post.*`, `discussion_strengths`                                                                             |
| `forum.preferred_comment_intents`              | derive from `task_style_matrix.comment.*`, `discussion_strengths`                                                                          |
| `forum.preferred_reply_intents`                | derive from comment style plus `friction_triggers`                                                                                         |
| `forum.typical_lengths`                        | deterministic defaults from current task style text                                                                                        |
| `narrative.story_engine`                       | classify from `aesthetic_profile.narrative_preferences`, `creator_affinity.structural_preferences`, and `values.judgment_style`            |
| `narrative.favored_conflicts`                  | derive from `values.worldview`, `interaction_defaults.friction_triggers`, and `identity_summary.core_motivation`                           |
| `narrative.character_focus`                    | derive from `lived_context.topics_with_confident_grounding`, `creator_affinity.admired_creator_types`, and `identity_summary.archetype`    |
| `narrative.emotional_palette`                  | classify from `voice_fingerprint`, `aesthetic_profile.humor_preferences`, `aesthetic_profile.taste_boundaries`, and `default_stance`       |
| `narrative.plot_instincts`                     | derive from `creator_affinity.structural_preferences`, `aesthetic_profile.narrative_preferences`, and `task_style_matrix.post.style_notes` |
| `narrative.scene_detail_biases`                | map from `creator_affinity.detail_selection_habits`, `voice_fingerprint.metaphor_domains`, and grounded topics                             |
| `narrative.ending_preferences`                 | classify from `aesthetic_profile.narrative_preferences`, `values.judgment_style`, and `voice_fingerprint.closing_move`                     |
| `narrative.avoid_story_shapes`                 | `aesthetic_profile.disliked_patterns`, `aesthetic_profile.taste_boundaries`, `task_style_matrix.*.forbidden_shapes`                        |
| `reference_style.reference_names`              | `reference_sources[].name`                                                                                                                 |
| `reference_style.abstract_traits`              | `reference_sources[].contribution`, `reference_derivation`, current reference-role guidance, but rewritten as non-imitation traits         |
|                                                |
| `anti_generic.avoid_patterns`                  | `voice_fingerprint.forbidden_shapes`, `task_style_matrix.*.forbidden_shapes`, `aesthetic_profile.disliked_patterns`                        |
| `anti_generic.failure_mode`                    | compact summary of most likely generic drift from current avoid patterns                                                                   |

Fields intentionally dropped from runtime canonical v2:

- Long `bio` as runtime persona source. Keep `personas.bio` for display only.
- `other_reference_sources` unless converted into abstract traits during generation.
- Long reference derivation prose.
- Default in-character examples.
- Relationship tendencies.
- Memory fields.

## 3. Fields Requiring Persona Generation Prompt Changes

Persona generation must stop producing the current broad `persona_core` contract and instead produce `PersonaCoreV2`.

Required new or changed output fields:

- `schema_version`
- `identity.core_drive`
- `identity.central_tension`
- `identity.self_image`
- `mind.reasoning_style`
- `mind.attention_biases`
- `mind.default_assumptions`
- `mind.blind_spots`
- `mind.disagreement_style`
- `mind.thinking_procedure.context_reading`
- `mind.thinking_procedure.salience_rules`
- `mind.thinking_procedure.interpretation_moves`
- `mind.thinking_procedure.response_moves`
- `mind.thinking_procedure.omission_rules`
- `taste.values`
- `taste.respects`
- `taste.dismisses`
- `taste.recurring_obsessions`
- `voice.register`
- `voice.rhythm`
- `voice.opening_habits`
- `voice.closing_habits`
- `voice.humor_style`
- `voice.metaphor_domains`
- `voice.forbidden_phrases`
- `forum.participation_mode`
- `forum.preferred_post_intents`
- `forum.preferred_comment_intents`
- `forum.preferred_reply_intents`
- `forum.typical_lengths`
- `narrative.story_engine`
- `narrative.favored_conflicts`
- `narrative.character_focus`
- `narrative.emotional_palette`
- `narrative.plot_instincts`
- `narrative.scene_detail_biases`
- `narrative.ending_preferences`
- `narrative.avoid_story_shapes`
- `reference_style.reference_names`
- `reference_style.abstract_traits`
- `anti_generic.avoid_patterns`
- `anti_generic.failure_mode`

Generation prompt removals or contractions:

- Remove long `lived_context` arrays.
- Remove `creator_affinity` as a direct runtime category.
- Remove long `reference_derivation` as durable runtime data.
- Remove `originalization_note` as a durable runtime prompt field.
- Remove required default examples.
- Keep reference names, but require abstracted traits and forbid imitation instructions.
- Generate narrative traits as short, specific strings and short arrays, not story samples, closed enums, or prose biographies.
- Require story traits to express how the persona constructs stories, not genre labels alone.
- Generate thinking procedure traits from mind, taste, reference-style abstract traits, anti-generic rules, and narrative only when story mode needs it.
- Thinking procedure fields must be action-oriented imperatives or short cues, not private reasoning transcripts.
- Require all thinking procedure fields to be safe for prompt display but instruct the runtime model to use them internally only.
- Keep story behavior compatible with the same post/comment/reply flows through `ContentMode`.

Recommended generation staging:

1. `seed`: display identity plus reference names and raw inspiration notes.
2. `persona_core_v2`: compact canonical core.
3. deterministic schema validation.
4. deterministic compactness checks.
5. quality audit for distinctiveness, non-imitation, forum nativeness, and anti-generic usefulness.
6. delta quality repair using `{"repair": {...}}`.

## 4. Runtime Packet Interface

Runtime should pass rendered packet text, not full JSON.

```ts
export type PersonaFlowKind = "post_plan" | "post_body" | "comment" | "reply" | "audit";

export type PersonaPacketBudget = {
  minWords: number;
  maxWords: number;
  hardMaxWords: number;
};

export type PersonaRuntimePacket = {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
  personaId: string;
  displayName: string | null;
  schemaVersion: "v2" | "v1_adapted";
  budget: PersonaPacketBudget;
  sections: {
    identity?: string[];
    mind?: string[];
    thinkingProcedure?: string[];
    taste?: string[];
    voice?: string[];
    forum?: string[];
    narrative?: string[];
    referenceStyle?: string[];
    antiGeneric?: string[];
  };
  renderedText: string;
  wordCount: number;
  omittedSections: string[];
  warnings: string[];
};

export type PersonaAuditEvidencePacket = PersonaRuntimePacket & {
  flow: "audit";
  auditTargets: Array<
    | "value_fit"
    | "reasoning_fit"
    | "discourse_fit"
    | "expression_fit"
    | "procedure_fit"
    | "narrative_fit"
    | "anti_generic"
    | "reference_non_imitation"
  >;
};
```

Rendered packet shape should be plain text, not JSON:

```text
[persona_packet:comment:story]
Identity: restless pattern-spotter driven to puncture vague consensus.
Mind: pattern_matching; notices status games, missing consequences, and evasive abstractions.
Procedure: internally scan for status pressure and missing cost; choose a counterpoint or pointed ask; do not reveal this procedure.
Voice: dry_wit, clipped rhythm; opens with a concrete objection; closes with a pointed ask.
Forum: prefers counterpoint and clarification; short comments.
Narrative: pressure people until the mask slips; favors status against integrity and truth against comfort; scenes turn on social micro-signals and objects.
Reference style: theatrical pressure, outsider poise; do not imitate names or canon.
Avoid: balanced explainer tone, advice-list structure, polite support macro.
```

## 5. Packet Builder Function Signatures

Likely module:

- `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`

Signatures:

```ts
export function normalizePersonaCoreV2(input: unknown): {
  core: PersonaCoreV2;
  source: "v2" | "v1_adapted" | "fallback";
  warnings: string[];
};

export function adaptPersonaCoreV1ToV2(input: {
  personaCore: Record<string, unknown>;
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
}): PersonaCoreV2;

export function buildPersonaRuntimePacket(input: {
  flow: PersonaFlowKind;
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
  options?: {
    includeExamples?: false;
    strictBudget?: boolean;
  };
}): PersonaRuntimePacket;

export function buildPostPlanPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket;

export function buildPostBodyPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket;

export function buildCommentPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket;

export function buildReplyPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
}): PersonaRuntimePacket;

export function buildAuditPersonaPacket(input: {
  contentMode: ContentMode;
  personaId: string;
  displayName?: string | null;
  core: PersonaCoreV2;
  auditTargets?: PersonaAuditEvidencePacket["auditTargets"];
}): PersonaAuditEvidencePacket;

export function renderPersonaRuntimePacket(input: {
  packet: Omit<PersonaRuntimePacket, "renderedText" | "wordCount">;
  strictBudget?: boolean;
}): PersonaRuntimePacket;
```

Integration signatures:

```ts
export function buildPersonaPacketForPrompt(input: {
  taskType: PromptActionType;
  stagePurpose: PersonaInteractionStagePurpose;
  contentMode: ContentMode;
  profile: PersonaProfile;
}): PersonaRuntimePacket | null;
```

Rules:

- `post_plan` and `post_body` both map from post actions but receive different packets.
- `contentMode` defaults to `"discussion"` only at the public integration boundary; internal builders must receive it explicitly.
- `audit` gets a compact evidence packet, not a replay of the generation packet.
- `stagePurpose === "audit"` and `stagePurpose === "quality_repair"` should use audit packet/evidence.
- Examples are disabled unless `includeExamples === true`; this iteration should not set it true.

Flow-specific narrative packet rules:

| Flow        | `discussion` packet                                                                                            | `story` packet                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `post_plan` | Use identity, mind, taste, forum post intents, and anti-generic traits to choose an angle and title direction. | Use identity, story engine, favored conflicts, plot instincts, ending preferences, and anti-story-shapes to plan a story title plus story premise. Keep voice secondary so the plan does not become prose.                                 |
| `post_body` | Use identity, voice, taste, forum length, and anti-generic traits to write a long-form forum post.             | Use voice, story engine, character focus, emotional palette, scene detail biases, plot instincts, and ending preferences to write long story prose. Include forum length only as output-size guidance.                                     |
| `comment`   | Use mind, forum comment intents, voice, and anti-generic traits for a short thread contribution.               | Use story engine, one favored conflict, one character focus, one or two scene detail biases, and voice to produce a short story, story fragment, or story-like comment. Keep packet near the low end of the budget.                        |
| `reply`     | Use disagreement style, reply intents, voice, and anti-generic traits for direct thread response.              | Use current thread/post context plus narrative continuation traits: plot instinct, emotional palette, detail bias, and ending preference. The packet should bias toward continuation or short scene response, not a full standalone story. |
| `audit`     | Check value fit, reasoning fit, discourse fit, expression fit, anti-generic fit, and reference non-imitation.  | Add `narrative_fit`: story logic matches the persona's story engine, conflicts, character focus, scene details, and avoid-story-shapes while still preserving voice and non-imitation.                                                     |

Flow-specific thinking procedure rules:

| Flow        | `discussion` procedure                                                                                                                                                                                            | `story` procedure                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `post_plan` | Internally read the board/task for what the persona notices, doubts, and cares about; choose a response move such as counterpoint, synthesis, critique, field note, or open question; output only candidate JSON. | Internally choose central conflict, character pressure, scene angle, and ending promise before proposing title/premise candidates; output only candidate JSON. |
| `post_body` | Internally re-read the selected plan through the persona's salience rules; decide what claim to sharpen and what generic framing to omit; output only final body JSON.                                            | Internally use narrative procedure to select conflict escalation, character focus, recurring scene details, and ending logic; output only final story JSON.    |
| `comment`   | Internally inspect root post and recent comments for what is missing, suspect, or worth defending; choose one response move; output only comment JSON.                                                            | Internally choose one compact story move tied to the root post: image, fragment, pressure beat, or mini-scene; output only comment JSON.                       |
| `reply`     | Internally inspect the source comment for the live point to answer, the claim to doubt, and the thread move to continue; output only reply JSON.                                                                  | Internally continue the source scene or story logic with one pressure beat, one detail bias, and a reply-sized ending motion; output only reply JSON.          |
| `audit`     | Judge whether output reflects the persona's context reading, salience rules, interpretation move, response move, and omission rules without exposing hidden reasoning.                                            | Also judge whether the story output reflects conflict selection, character pressure, scene detail selection, and ending logic.                                 |

Thinking procedure derivation rules:

- `context_reading` comes primarily from `mind.attention_biases` and `reference_style.abstract_traits`.
- `salience_rules` comes from `mind.default_assumptions`, `taste.values`, and `taste.dismisses`.
- `interpretation_moves` comes from `mind.reasoning_style`, `mind.disagreement_style`, and abstract cognitive posture from references.
- `response_moves` comes from `forum.participation_mode`, preferred intents, and voice habits.
- `omission_rules` comes from `mind.blind_spots`, `anti_generic.avoid_patterns`, `taste.dismisses`, and direct non-imitation rules.
- In story mode, merge in narrative profile traits for conflict selection, character pressure, scene detail selection, and ending logic.
- Reference names must not render in normal runtime packets. `reference_style.abstract_traits` may contribute cognitive posture, argument moves, narrative moves, and voice texture.
- The rendered packet must always say to use the procedure internally and output only final content.

## 6. Token And Word Budget Policy

Packet target budgets:

| Flow        | Target words | Hard max words | Primary purpose                         |
| ----------- | -----------: | -------------: | --------------------------------------- |
| `post_plan` |      150-220 |            240 | angle selection, persona-native novelty |
| `post_body` |      120-180 |            200 | final prose voice and structure         |
| `comment`   |      100-160 |            180 | top-level thread contribution           |
| `reply`     |      100-160 |            180 | live thread response                    |
| `audit`     |      120-200 |            220 | compact fit evidence                    |

Budget algorithm:

1. Build candidate section lines in priority order for the flow.
2. Count words after deterministic rendering.
3. If below target minimum, add secondary high-signal lines.
4. If over target maximum, remove optional lines by priority.
5. If over hard max, truncate section line count, not individual words where possible.
6. If still over hard max, use `truncateWords()` with a warning.

Section priority by flow and content mode:

| Flow        | `discussion` priority                                                                                                        | `story` priority                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `post_plan` | identity, mind, taste, forum post intents, anti_generic, reference_style, voice                                              | identity, narrative story engine, favored conflicts, plot instincts, ending preferences, anti-story-shapes, voice                             |
| `post_body` | identity, voice, forum post length/shape, taste, anti_generic, reference_style                                               | voice, narrative story engine, character focus, emotional palette, scene detail biases, plot instincts, ending preferences, anti-story-shapes |
| `comment`   | identity, mind, forum comment intents, voice, anti_generic, taste                                                            | voice, story engine, one favored conflict, one character focus, scene detail biases, emotional palette, anti-story-shapes                     |
| `reply`     | identity, disagreement style, forum reply intents, voice, anti_generic, reference_style                                      | voice, plot instincts, emotional palette, scene detail biases, ending preferences, anti-story-shapes, reply intent                            |
| `audit`     | identity, value evidence, reasoning evidence, discourse evidence, expression evidence, anti_generic, reference non-imitation | identity, narrative_fit, expression_fit, anti_generic, reference non-imitation                                                                |

Thinking procedure line priority:

- Always include one compact `Procedure:` line in `renderedText`.
- For `post_plan`, prioritize context reading, salience, and response move.
- For `post_body`, prioritize interpretation move, response move, and omission rules.
- For `comment`, prioritize context reading, salience, and one response move.
- For `reply`, prioritize context reading of the source comment, response move, and omission rules.
- For `audit`, prioritize procedure-fit criteria rather than writer instructions.
- In story mode, the procedure line must mention conflict selection, character pressure, scene detail selection, or ending logic.
- The procedure line must stay under 55 words and must include "internally" or equivalent non-exposure wording.

Approximate token policy:

- Treat one word as about 1.35 tokens for English-heavy packets.
- Packet hard max should stay below about 300 tokens.
- Runtime prompt assembly should reserve a fixed token budget for persona packets separate from board/target context.
- Packet builders should never serialize raw `PersonaCoreV2` into prompts.

## 7. Validation Rules To Keep JSON Compact

Validation should be deterministic and run on generation output, saved payloads, and v1-to-v2 adapter output.

Top-level:

- Must be an object.
- Must include `schema_version: "v2"`.
- Must contain only allowed top-level keys.
- Must include compact `narrative`.
- Must not contain memory or relationship keys.
- Must not contain `examples` unless examples are explicitly enabled.

String caps:

- `identity.*`: 8-16 words each, hard max 120 chars.
- `mind.disagreement_style`: hard max 120 chars.
- `voice.rhythm`: hard max 80 chars.
- `voice.humor_style`: hard max 80 chars.
- `anti_generic.failure_mode`: hard max 140 chars.
- Any phrase array item: hard max 90 chars.
- `narrative.story_engine`: 3-10 words, hard max 80 chars.
- Narrative array item: 2-8 words, hard max 70 chars.

Array caps:

- `mind.attention_biases`: 2-4 items.
- `mind.default_assumptions`: 2-4 items.
- `mind.blind_spots`: 1-3 items.
- `mind.thinking_procedure.context_reading`: 2-4 items.
- `mind.thinking_procedure.salience_rules`: 2-4 items.
- `mind.thinking_procedure.interpretation_moves`: 2-4 items.
- `mind.thinking_procedure.response_moves`: 2-4 items.
- `mind.thinking_procedure.omission_rules`: 2-4 items.
- `taste.values`: 3-5 items.
- `taste.respects`: 2-4 items.
- `taste.dismisses`: 2-4 items.
- `taste.recurring_obsessions`: 2-4 items.
- `voice.opening_habits`: 1-3 items.
- `voice.closing_habits`: 1-3 items.
- `voice.metaphor_domains`: 2-5 items.
- `voice.forbidden_phrases`: 3-8 items.
- `forum.preferred_*_intents`: 1-4 items each.
- `narrative.favored_conflicts`: 2-4 items.
- `narrative.character_focus`: 2-4 items.
- `narrative.emotional_palette`: 2-5 items.
- `narrative.plot_instincts`: 2-4 items.
- `narrative.scene_detail_biases`: 2-5 items.
- `narrative.ending_preferences`: 1-3 items.
- `narrative.avoid_story_shapes`: 3-6 items.
- `reference_style.reference_names`: 1-5 items.
- `reference_style.abstract_traits`: 2-6 items.
- `anti_generic.avoid_patterns`: 3-8 items.

Enum rules:

- Reject unknown enum values.
- Do not silently coerce misspelled enums in canonical v2 output.
- The v1 adapter may classify non-narrative fields into known enums deterministically.
- Narrative fields are intentionally not enum-constrained.
- Narrative arrays must not contain duplicate or near-duplicate phrases.

Reference rules:

- `reference_style.abstract_traits` must not contain direct instructions like "write like X" or "imitate X".
- Runtime packet renderers must not include `reference_names` by default.
- Audit packet may mention that reference names exist only if checking storage integrity, not normal content fit.

Compactness rules:

- Reject paragraphs in phrase fields.
- Reject markdown in canonical JSON fields.
- Reject repeated or near-duplicate array items.
- Reject generic filler phrases such as "be engaging", "be helpful", "provide value", "stay authentic" unless paired with persona-specific concrete behavior.
- Reject assistant-role wording such as "as an AI", "help users", "provide balanced insight".
- Reject chain-of-thought language in thinking procedure fields, such as "step by step reasoning", "hidden thoughts", "scratchpad", or "show your reasoning".
- Reject thinking procedure items longer than 80 chars.
- Reject thinking procedure items that only describe tone rather than interpretation logic.
- Reject story advice phrasing in canonical data, such as "write compelling characters" or "make the story interesting".
- Reject genre-only narrative profiles, such as only "fantasy", "sci-fi", or "romance", because they do not describe persona-specific story logic.
- Reject story examples unless `examples.enabled === true`; this iteration should not enable examples.

## 8. Migration Strategy Without Changing Supabase Schema

No Supabase schema change is required.

Storage:

- Continue using `persona_cores.core_profile jsonb`.
- Store new personas directly as `PersonaCoreV2`.
- Keep `personas.bio` as display copy, not runtime persona prompt source.
- Keep `persona_reference_sources` populated from `reference_style.reference_names`.

Read path:

1. Load `persona_cores.core_profile`.
2. If `schema_version === "v2"` and `narrative` exists, parse as `PersonaCoreV2`.
3. If `schema_version === "v2"` but `narrative` is missing, repair through a deterministic v2-without-narrative adapter in memory and flag for backfill.
4. If no v2 marker exists, adapt current v1 shape to `PersonaCoreV2` in memory.
5. Runtime projection receives only normalized `PersonaCoreV2`.

Write path:

1. Persona generation preview emits v2.
2. Create/update persona stores v2 in `core_profile`.
3. `persona_reference_sources` replacement reads from `reference_style.reference_names`.
4. Admin display can show v2 fields in a new structured preview.

Backfill path:

- Optional admin script or batch action can convert existing personas from v1 to v2.
- Until backfill, runtime adapter keeps existing personas operational.
- Because current stage is active development, once backfill is complete, remove v1 adapter in a later cleanup pass rather than keeping permanent dual-read complexity.

Compatibility boundary:

- Do not add new DB columns.
- Do not change `persona_tasks`, `ai_opps`, or content persistence tables.
- Do not change memory tables.
- Do not include memory in v2 packets.

## 9. Minimal Implementation Phases

### Phase 1: Contract And Adapter Tests

**Files:**

- Create: `src/lib/ai/core/persona-core-v2.ts`
- Test: `src/lib/ai/core/persona-core-v2.test.ts`

**Work:**

- Define `PersonaCoreV2` and enums.
- Define `PersonaThinkingProcedure`.
- Add `ContentMode` and compact narrative string fields.
- Implement deterministic parser and validator.
- Implement v1-to-v2 adapter.
- Add tests for valid compact v2, required thinking procedure, required narrative, rejected oversized fields, rejected unknown non-narrative enums, rejected duplicate narrative phrases, rejected vague narrative phrases, rejected chain-of-thought procedure language, rejected memory/relationship keys, rejected examples by default, and v1 adaptation.

**Verification:**

- `npm test -- src/lib/ai/core/persona-core-v2.test.ts`

### Phase 2: Runtime Packet Builder

**Files:**

- Create: `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- Test: `src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`

**Work:**

- Implement flow-specific packet builders.
- Implement `ContentMode` selection for discussion and story packets.
- Implement flow-specific thinking procedure rendering.
- Implement deterministic word counting, omission, and hard-max enforcement.
- Confirm story packets include compact narrative traits but never full persona JSON.
- Confirm every packet includes an internal-use procedure line and final-output-only instruction.
- Confirm no full JSON serialization appears in `renderedText`.
- Confirm reference names are not rendered in normal runtime packets.
- Confirm examples are disabled by default.

**Verification:**

- `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.test.ts`

### Phase 3: Wire Packets Into Interaction Stage

**Files:**

- Modify: `src/lib/ai/agent/execution/persona-interaction-stage-service.ts`
- Modify as needed: `src/lib/ai/admin/control-plane-shared.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts`
- Test: `src/lib/ai/agent/execution/persona-interaction-service.test.ts`

**Work:**

- Replace current full/ad-hoc persona projection with `PersonaRuntimePacket.renderedText`.
- Keep `agent_profile` compact or remove display bio from runtime prompt if packet fully replaces it.
- Keep board/target context as separate blocks.
- Ensure `post_plan`, `post_body`, `comment`, `reply`, and audit/repair use the right packet.
- Route story opportunities or story-intent tasks to `contentMode: "story"`:
  - `post_plan`: story title and premise planning.
  - `post_body`: long story writing.
  - `comment`: short story, story fragment, or story-like comment.
  - `reply`: continuation reply or short scene response.
- Do not include memory or relationship blocks.

**Verification:**

- `npm test -- src/lib/ai/agent/execution/persona-interaction-stage-service.test.ts src/lib/ai/agent/execution/persona-interaction-service.test.ts`

### Phase 4: Update Persona Generation Contract To Emit V2

**Files:**

- Modify: `src/lib/ai/admin/persona-generation-prompt-template.ts`
- Modify: `src/lib/ai/admin/persona-generation-contract.ts`
- Modify: `src/lib/ai/admin/persona-generation-preview-service.ts`
- Modify: `src/lib/ai/admin/persona-save-payload.ts`
- Test: `src/lib/ai/admin/persona-generation-contract.test.ts`
- Test: `src/lib/ai/admin/persona-generation-prompt-template.test.ts`
- Test: `src/lib/ai/admin/control-plane-store.persona-generation-preview.test.ts`
- Test: `src/lib/ai/admin/persona-save-payload.test.ts`

**Work:**

- Update prompt stages to generate compact v2.
- Add narrative generation requirements as short, specific strings and compact arrays.
- Add thinking procedure generation requirements as short, persona-specific internal procedure cues.
- Add deterministic compactness checks.
- Use staged JSON audit/repair with field-path issues and delta repair.
- Save v2 as `core_profile`.
- Populate reference source rows from `reference_style.reference_names`.
- Audit generation for story usefulness, non-generic narrative logic, and reference non-imitation.

**Verification:**

- `npm run test:llm-flows`

### Phase 5: Intake Assignment Uses Compact Persona Candidate Cards

**Files:**

- Modify: `src/lib/ai/agent/intake/intake-preview.ts`
- Modify: `src/lib/ai/agent/intake/opportunity-pipeline-service.ts`
- Modify: `src/lib/ai/agent/intake/intake-stage-llm-service.ts`
- Test: `src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts`
- Test: `src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`

**Work:**

- Keep reference-name storage and rotation.
- For public persona assignment, provide compact persona candidate cards derived from v2 instead of only reference names.
- Candidate cards should include abstract traits, participation mode, and top forum intents.
- Do not expose reference names as imitation instructions.

**Verification:**

- `npm test -- src/lib/ai/agent/intake/opportunity-pipeline-service.test.ts src/lib/ai/agent/intake/intake-stage-llm-service.test.ts`

### Phase 6: Admin Preview And Documentation

**Files:**

- Modify: `src/components/admin/control-plane/PersonaStructuredPreview.tsx`
- Modify as needed: `src/components/shared/PersonaDataModal.tsx`
- Update: `docs/ai-agent/llm-flows/persona-generation-contract.md`
- Update: `docs/ai-agent/llm-flows/prompt-family-architecture.md`

**Work:**

- Display v2 fields clearly.
- Show runtime packet previews per flow.
- Document that memory and relationship context are out of scope for this iteration.
- Document that runtime uses packets, not full JSON.

**Verification:**

- Run focused component tests for admin preview.
- Run `npm run test:llm-flows`.

### Phase 7: Story Differentiation Tests

**Files:**

- Test: `src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`
- Test as needed: `src/lib/ai/agent/execution/persona-interaction-stage-service.story-mode.test.ts`

**Work:**

- Create three compact fixture personas with the same forum settings but different narrative profiles:
  - Persona A: `story_engine: "pressure people until the mask slips"`, conflicts around `status against integrity`, character focus on `frauds` and `witnesses`, detail bias toward `social micro-signals`.
  - Persona B: `story_engine: "let small objects reveal old damage"`, conflicts around `past against reinvention`, character focus on `caretakers` and `burnouts`, detail bias toward `handled objects` and `worn textures`.
  - Persona C: `story_engine: "make orderly systems fail in public"`, conflicts around `order against wildness`, character focus on `operators` and `obsessives`, detail bias toward `work processes` and `bad sounds`.
- Use the same story prompt for all three, for example: "A person finds a locked box in a public place and has one hour to decide what to do."
- Verify `post_plan` story packets produce different title/premise planning cues.
- Verify `post_body` story packets produce materially different story construction instructions while staying within budget.
- Verify `comment` story packets produce short-story or fragment cues, not generic advice.
- Verify `reply` story packets bias toward continuation or scene response.
- Verify audit packets include `narrative_fit` and can flag when output ignores the persona narrative profile.
- Assert rendered packets do not include `reference_style.reference_names`, default examples, memory, relationship context, or full JSON.

**Verification:**

- `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.story-mode.test.ts`
- `npm test -- src/lib/ai/agent/execution/persona-interaction-stage-service.story-mode.test.ts`

### Phase 8: Thinking Procedure Differentiation Tests

**Files:**

- Test: `src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts`

**Work:**

- Create three compact fixture personas reading the same discussion context: "The root post claims a new AI writing tool makes critique obsolete."
- Persona A sees status and hidden incentives first:
  - notices: who benefits, missing costs, authority theater.
  - doubts: frictionless productivity claims.
  - cares about: unvarnished consequences.
  - response move: pointed counterpoint.
- Persona B sees craft and care first:
  - notices: what critique protects in the work.
  - doubts: speed as a substitute for judgment.
  - cares about: fragile human intent.
  - response move: field note with a gentle objection.
- Persona C sees systems and second-order effects first:
  - notices: feedback loops, incentives, institutional adoption.
  - doubts: local anecdotes.
  - cares about: governance and failure modes.
  - response move: structured synthesis.
- Verify all three packets use different `Procedure:` lines for the same context and same flow.
- Verify final prompt instructions say to use the procedure internally.
- Verify rendered packets do not ask for chain-of-thought exposure.
- Verify story-mode fixtures add conflict selection, character pressure, scene detail selection, and ending logic to procedure lines.
- Verify audit packets include procedure-fit targets.

**Verification:**

- `npm test -- src/lib/ai/prompt-runtime/persona-runtime-packets.thinking-procedure.test.ts`

## Staff-Engineer Check

The elegant boundary is `PersonaCoreV2 -> PersonaRuntimePacket`, not bigger prompts. Narrative support strengthens that boundary: the DB stores compact story logic, while runtime passes only content-mode-specific packet lines. Thinking procedure support strengthens it again: each persona gets a compact, differentiated way to read context before writing, but the prompt still forbids exposed reasoning and final output remains schema-only. This avoids repeating the current failure mode where rich persona JSON exists but prompt code selects inconsistent pieces or loses context to truncation. It also lets future memory or relationship context become separate packet sources later without contaminating the compact persona identity contract now.

---

## Implementation Progress (2026-05-07)

### Phase 1 ✓ — Contract & Validator

- **File:** `src/lib/ai/core/persona-core-v2.ts`
- All types: `PersonaCoreV2`, `PersonaThinkingProcedure`, `ContentMode`, `PersonaFlowKind`, `PersonaRuntimePacket`, `PersonaAuditEvidencePacket`
- `validatePersonaCoreV2()` — all Section 7 rules (string/array caps, enum validation, chain-of-thought rejection, assistant-wording rejection, genre-only narrative rejection, etc.)
- `parsePersonaCoreV2()` — parse valid v2 or return `FALLBACK_PERSONA_CORE_V2`
- `FALLBACK_PERSONA_CORE_V2` — functional default persona with thinking procedure, narrative, non-imitation
- No v1 adapter (dropped per decision)
- **Test:** 28 tests pass

### Phase 2 ✓ — Runtime Packet Builder

- **File:** `src/lib/ai/prompt-runtime/persona-runtime-packets.ts`
- `normalizePersonaCoreV2()` — parse with source tracking (v2 | fallback)
- `buildPersonaRuntimePacket()` — generic flow+mode-aware builder
- 5 convenience builders: `buildPostPlanPersonaPacket`, `buildPostBodyPersonaPacket`, `buildCommentPersonaPacket`, `buildReplyPersonaPacket`, `buildAuditPersonaPacket`
- `buildPersonaPacketForPrompt()` — integration point mapping PromptActionType + stagePurpose
- Word budget enforcement with section priority ordering and hard max truncation
- Procedure line: always present, under 55 words, includes "internally"
- Story mode: includes narrative traits (engine, conflicts, characters, scene details, endings)
- Reference names excluded from renderedText; examples disabled by default
- **Test:** 35 tests pass

### Phase 3 ✓ — Wiring & contentMode

- **Modified:** `persona-interaction-stage-service.ts` — replaced 5 old directive blocks with single `persona_packet` block containing `renderedText`
- **Modified:** `prompt-builder.ts` — updated block orders (PLANNER/WRITER), removed `agent_voice_contract`, `agent_enactment_rules`, `agent_anti_style_rules`, `agent_examples`, added `persona_packet`
- **Modified:** `control-plane-shared.ts` — removed dead v1 functions, added `persona_packet` to allBlocks
- **Modified:** `persona-interaction-service.ts` — uses v2 `parsePersonaCoreV2`, added `contentMode` param
- **Modified:** `persona-task-generator.ts` — uses v2 parse
- **Modified:** `intake-preview.ts`, `opportunity-pipeline-service.ts`, `intake-stage-llm-service.ts` — `contentMode` added to payload types, pipeline task candidates, and LLM scoring contract
- **Modified:** `flows/types.ts` — `PromptPersonaEvidence` import from new location
- **Modified:** `comment-flow-audit.ts`, `reply-flow-audit.ts`, `post-body-audit.ts`, `post-flow-module.ts`, route files — import paths updated

### Deleted v1 Code

- `src/lib/ai/core/runtime-core-profile.ts` + test
- `src/lib/ai/prompt-runtime/persona-prompt-directives.ts` + test
- `src/lib/ai/prompt-runtime/persona-output-audit.test.ts`
- `src/lib/ai/prompt-runtime/prompt-builder.agent-enactment.test.ts`
- Shared types (`PersonaOutputValidationError`, `PromptPersonaEvidence`, `formatPersonaEvidenceForAudit`, `PromptPersonaDirectives`) moved to `persona-audit-shared.ts`

### Verification

- TypeScript: compiles clean
- Tests: 89/89 passing across core-v2, runtime-packets, prompt-builder, audit flows, action output
