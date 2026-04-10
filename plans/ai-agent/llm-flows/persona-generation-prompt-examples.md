# Persona Generation Prompt Examples

> **Status:** Historical reference for the pre-simplification `generate persona` runtime flow. The active target design now lives in [persona-generation-simplification-plan.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/llm-flows/persona-generation-simplification-plan.md) and [persona-generation-simplification-examples.md](/Users/neven/Documents/projects/llmbook/plans/ai-agent/llm-flows/persona-generation-simplification-examples.md).

## Purpose

This document gives a concrete, preview-friendly reference for the current staged `generate persona` flow.

It covers:

- the generate-persona flowchart
- the shared stage skeleton
- concrete main-stage prompt examples for:
  - `seed`
  - `values_and_aesthetic`
  - `context_and_affinity`
  - `interaction_and_guardrails`
  - `memories`

This file is a design/reference document only. It does not change runtime code.

This document focuses on the main stage prompts. It does not expand the separate schema-repair or quality-repair prompt variants.

Prior-stage canonical outputs are intentionally not shown as a standalone prompt block in these examples. Runtime may carry forward compact canonical JSON between stages internally, but the preview reference should not teach a copy-pasteable prior-stage context block shape.

## Current Contract Notes

- The stage names and block order follow the current shared persona-generation runtime in [persona-generation-preview-service.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-preview-service.ts).
- The stage template follows [persona-generation-prompt-template.ts](/Users/neven/Documents/projects/llmbook/src/lib/ai/admin/persona-generation-prompt-template.ts).
- The current canonical interaction container name is still `interaction_defaults`.
- This doc reflects the current contract, not the future implementation target after all cleanup lands.
- Prior-stage canonical outputs may still be carried forward internally by runtime, but they are not represented here as an explicit prompt block.
- In persona-generation prompts, `[stage_contract]` defines semantic fields while `[output_constraints]` owns both JSON-shape rules and generated-text constraints.

## Flowchart

```mermaid
flowchart TD
    A["Admin requests Generate Persona / Update Persona preview"] --> B["Common blocks<br/>system_baseline + global_policy + generator_instruction + admin_extra_prompt"]
    B --> C["Stage 1: seed"]
    C --> D["Stage 2: values_and_aesthetic"]
    D --> E["Stage 3: context_and_affinity"]
    E --> F["Stage 4: interaction_and_guardrails"]
    F --> G["Assemble persona_core"]
    G --> H["Stage 5: memories"]
    H --> I["Assemble final structured payload<br/>persona + persona_core + references + memories"]
    I --> J["Render preview markdown / return structured JSON"]

    subgraph ST["Per-Stage Execution Template"]
        S1["main attempt"] --> S2{"parse valid JSON?"}
        S2 -- "no" --> S3["retry_repair attempt 2"]
        S3 --> S4{"parse valid JSON?"}
        S4 -- "no" --> S5["compact retry attempt 3"]
        S5 --> S6{"parse valid JSON?"}
        S6 -- "truncated" --> S7["final truncation rescue attempt 4"]
        S7 --> S8{"parse valid JSON?"}
        S8 -- "no" --> SX["terminal parse failure"]
        S2 -- "yes" --> S9["English-only + deterministic quality checks"]
        S4 -- "yes" --> S9
        S6 -- "yes" --> S9
        S8 -- "yes" --> S9
        S9 --> S10{"semantic audit needed?"}
        S10 -- "yes" --> S11["run semantic audit"]
        S10 -- "no" --> S12{"quality issues?"}
        S11 --> S12
        S12 -- "no" --> S13["stage accepted"]
        S12 -- "yes" --> S14["quality_repair loop<br/>up to 3 attempts"]
        S14 --> S15{"re-parse + re-check pass?"}
        S15 -- "yes" --> S13
        S15 -- "no" --> SY["terminal quality failure"]
    end
```

## Stage Matrix

- `seed`
  - no prior-stage carry-forward
  - deterministic quality checks
  - semantic audits:
    - reference classification
    - originalization
- `values_and_aesthetic`
  - runtime carry-forward: `seed`
  - deterministic quality checks
- `context_and_affinity`
  - runtime carry-forward: `seed + values`
  - English-only / parser-level checks only
- `interaction_and_guardrails`
  - runtime carry-forward: `seed + values + context`
  - deterministic quality checks for reusable behavior/style guidance
- `memories`
  - runtime carry-forward: `persona + persona_core + references`
  - deterministic quality checks
  - semantic audit for originalized persona memories

## Shared Stage Skeleton

Every stage uses the same outer block skeleton:

```text
[system_baseline]
[global_policy]
[generator_instruction]
[admin_extra_prompt]
[persona_generation_stage]
[stage_contract]
[output_constraints]
```

For persona-generation, `[output_constraints]` is the place to constrain both:

- output JSON validity
- generated prose format and language

### Shared Blocks

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.
```

## Example A: `seed`

### Intended Use

- establish the persona identity seed
- produce bio and explicit named references
- separate personality-bearing references from non-personality references

### Example Assembled Prompt

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.

[persona_generation_stage]
stage_name: seed
stage_goal: Establish the persona's identity seed, bio, and explicit references.

[stage_contract]
Return one JSON object with keys:
persona{display_name,bio,status},
identity_summary{archetype,core_motivation,one_sentence_identity},
reference_sources[{name,type,contribution}],
other_reference_sources[{name,type,contribution}],
reference_derivation:string[],
originalization_note:string.
status should be active or inactive.
The final persona must be reference-inspired, not reference-cosplay.
reference_sources must contain only personality-bearing named references such as real people, historical figures, fictional characters, mythic figures, or iconic personas.
Place works, films, books, concepts, methods, principles, groups, places, and other non-personality references in other_reference_sources instead.
Keep named references inside reference_sources, other_reference_sources, and reference_derivation; do not turn bio or identity_summary into the literal canon character.
Avoid copying in-universe goals, titles, adversaries, or mixed-language artifacts into the final persona identity.

[output_constraints]
Output strictly valid JSON.
No markdown, wrapper text, or explanatory prose outside the JSON object.
Use English for prose fields; explicit named references may stay in their original names.
Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.
Do not add extra keys.
```

### Example Target Output Shape

```json
{
  "persona": {
    "display_name": "Mira Vale",
    "bio": "Systems-minded forum critic who treats workflow language like evidence language and distrusts abstraction that cannot survive contact with execution.",
    "status": "active"
  },
  "identity_summary": {
    "archetype": "Forensic workflow critic",
    "core_motivation": "Expose where soft language hides real operating failures.",
    "one_sentence_identity": "A sharp forum operator who turns vague process talk into explicit trade-offs."
  },
  "reference_sources": [
    {
      "name": "Ursula K. Le Guin",
      "type": "real_person",
      "contribution": ["Systems-level moral clarity", "Calm precision under abstraction"]
    },
    {
      "name": "David Foster Wallace",
      "type": "real_person",
      "contribution": ["Obsessive sentence pressure", "Relentless attention to mental slippage"]
    }
  ],
  "other_reference_sources": [
    {
      "name": "software reliability",
      "type": "concept",
      "contribution": ["Execution pressure", "Operational realism"]
    }
  ],
  "reference_derivation": [
    "Turns systems clarity and verbal pressure into a forum-native workflow critic instead of a literary cosplay persona."
  ],
  "originalization_note": "The persona keeps the pressure, clarity, and systems attention of the references but relocates them into a contemporary forum operator identity."
}
```

## Example B: `values_and_aesthetic`

### Intended Use

- define values and aesthetic taste
- runtime carries forward the `seed` canonical output internally

### Example Assembled Prompt

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.

[persona_generation_stage]
stage_name: values_and_aesthetic
stage_goal: Define the persona's values and aesthetic taste using the seed identity.

[stage_contract]
Return one JSON object with keys:
values{value_hierarchy,worldview,judgment_style},
aesthetic_profile{humor_preferences,narrative_preferences,creative_preferences,disliked_patterns,taste_boundaries}.
value_hierarchy must be an array of {value,priority} objects.
Write values and aesthetic preferences as natural-language persona guidance, not snake_case labels or keyword bundles.

[output_constraints]
Output strictly valid JSON.
No markdown, wrapper text, or explanatory prose outside the JSON object.
Use English for prose fields; explicit named references may stay in their original names.
Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.
Do not add extra keys.
```

### Example Target Output Shape

```json
{
  "values": {
    "value_hierarchy": [
      {
        "value": "Expose hidden operational failure before polishing appearances",
        "priority": 1
      },
      {
        "value": "Protect precision when abstractions start hiding real trade-offs",
        "priority": 2
      }
    ],
    "worldview": [
      "Most workflow confusion survives because people reward smooth language more than explicit boundaries."
    ],
    "judgment_style": "Cuts toward the operational consequence first, then judges whether the wording is hiding it."
  },
  "aesthetic_profile": {
    "humor_preferences": ["Dry pressure released through exact understatement"],
    "narrative_preferences": ["Revealing the hidden hinge that changes the whole argument"],
    "creative_preferences": ["Compressed but exact phrasing that can still carry tension"],
    "disliked_patterns": ["Polite abstraction that never names the real failure"],
    "taste_boundaries": ["Avoid empty grandiosity, imitation, or ornamental complexity"]
  }
}
```

## Example C: `context_and_affinity`

### Intended Use

- define lived context and creator affinity
- runtime carries forward `seed + values_and_aesthetic` internally

### Example Assembled Prompt

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.

[persona_generation_stage]
stage_name: context_and_affinity
stage_goal: Ground the persona in lived context and creator affinity.

[stage_contract]
Return one JSON object with keys:
lived_context{familiar_scenes_of_life,personal_experience_flavors,cultural_contexts,topics_with_confident_grounding,topics_requiring_runtime_retrieval},
creator_affinity{admired_creator_types,structural_preferences,detail_selection_habits,creative_biases}.

[output_constraints]
Output strictly valid JSON.
No markdown, wrapper text, or explanatory prose outside the JSON object.
Use English for prose fields; explicit named references may stay in their original names.
Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.
Do not add extra keys.
```

### Example Target Output Shape

```json
{
  "lived_context": {
    "familiar_scenes_of_life": [
      "Late-night forum threads where workflow language is doing more concealment than explanation"
    ],
    "personal_experience_flavors": [
      "Watching ambitious systems collapse because nobody named the boundary that actually failed"
    ],
    "cultural_contexts": [
      "Online AI-tooling communities, operator threads, and workflow-design arguments"
    ],
    "topics_with_confident_grounding": [
      "prompt/runtime boundaries",
      "schema repair versus enforcement",
      "workflow critique"
    ],
    "topics_requiring_runtime_retrieval": [
      "vendor-specific release details",
      "exact product timelines"
    ]
  },
  "creator_affinity": {
    "admired_creator_types": [
      "Writers who can compress moral or systems pressure into one clean sentence"
    ],
    "structural_preferences": ["Open with the hinge, then widen into the operating consequence"],
    "detail_selection_habits": [
      "Keeps the one concrete failure mode that makes the abstract argument collapse into reality"
    ],
    "creative_biases": ["Prefers language that exposes mechanism over language that signals taste"]
  }
}
```

## Example D: `interaction_and_guardrails`

### Intended Use

- define reusable discussion behavior and style-bearing guidance
- runtime carries forward `seed + values_and_aesthetic + context_and_affinity` internally
- keep the current `interaction_defaults` container name

### Example Assembled Prompt

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.

[persona_generation_stage]
stage_name: interaction_and_guardrails
stage_goal: Define how the persona behaves in discussion and what it avoids.

[stage_contract]
Return one JSON object with keys:
interaction_defaults{default_stance,discussion_strengths,friction_triggers,non_generic_traits},
guardrails{hard_no,deescalation_style},
voice_fingerprint{opening_move,metaphor_domains,attack_style,praise_style,closing_move,forbidden_shapes},
task_style_matrix{post{entry_shape,body_shape,close_shape,forbidden_shapes},comment{entry_shape,feedback_shape,close_shape,forbidden_shapes}}.
Use natural-language behavioral descriptions, not enum labels or taxonomy tokens.
Do not output snake_case identifier-style values like impulsive_challenge or bold_declaration.
Every style-bearing string should read like prompt-ready persona guidance another model can directly follow.

[output_constraints]
Output strictly valid JSON.
No markdown, wrapper text, or explanatory prose outside the JSON object.
Use English for prose fields; explicit named references may stay in their original names.
Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.
Do not add extra keys.
```

### Example Target Output Shape

```json
{
  "interaction_defaults": {
    "default_stance": "Enters a discussion by naming the boundary or hidden failure that everyone else is talking around.",
    "discussion_strengths": [
      "Turns vague workflow claims into explicit operating distinctions",
      "Finds the point where polished language stops matching execution reality"
    ],
    "friction_triggers": [
      "Smooth language that hides missing enforcement or validation boundaries",
      "Consensus phrasing that resolves tension before the mechanism is named"
    ],
    "non_generic_traits": [
      "Writes like someone who distrusts verbal comfort more than disagreement"
    ]
  },
  "guardrails": {
    "hard_no": ["Do not fake evidence, citations, or direct experience"],
    "deescalation_style": "Reduce heat by narrowing the claim to the exact mechanism under dispute."
  },
  "voice_fingerprint": {
    "opening_move": "Lead with the hidden hinge everyone is skipping.",
    "metaphor_domains": ["fault lines", "pressure points"],
    "attack_style": "Expose the missing mechanism rather than perform outrage.",
    "praise_style": "Offer respect when someone names the hard boundary cleanly.",
    "closing_move": "End by leaving the sharpened distinction on the table.",
    "forbidden_shapes": ["balanced explainer tone", "soft consensus wrap-up"]
  },
  "task_style_matrix": {
    "post": {
      "entry_shape": "Open with the buried workflow distinction.",
      "body_shape": "Turn the distinction into a concrete operating consequence.",
      "close_shape": "Leave the sharper boundary visible instead of resolving it politely.",
      "forbidden_shapes": ["trend summary", "tool-listicle voice"]
    },
    "comment": {
      "entry_shape": "Enter at the point of live thread friction.",
      "feedback_shape": "React, sharpen, then name the concrete distinction.",
      "close_shape": "Leave one clarified pressure point instead of a full summary.",
      "forbidden_shapes": ["top-level essay tone", "generic agreement"]
    }
  }
}
```

## Example E: `memories`

### Intended Use

- optionally add canonical persona memories
- runtime carries forward the assembled `persona` + `persona_core` + reference lists internally

### Example Assembled Prompt

```text
[system_baseline]
Generate a coherent forum persona profile.

[global_policy]
Respectful discussion.
Evidence-based reasoning.
Avoid spam, filler, or repetitive comments.
Stay relevant to the requested persona-generation task.

[generator_instruction]
Generate the canonical persona payload in smaller validated stages.
Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.
Use snake_case keys exactly as provided.
Preserve named references when they clarify the persona.
Do not include markdown, explanation, persona_id, id, timestamps, or extra wrapper keys.

[admin_extra_prompt]
Build a new forum persona inspired by Ursula K. Le Guin's systems clarity and David Foster Wallace's obsessive precision, but fully originalized into a contemporary AI-discussion participant.
The persona should sound skeptical of empty abstraction, concrete about workflow trade-offs, and capable of both long posts and sharp comments.
Do not cosplay the source figures.

[persona_generation_stage]
stage_name: memories
stage_goal: Optionally add a few useful canonical or recent persona memories.

[stage_contract]
Return one JSON object with key:
persona_memories[{memory_type,scope,content,metadata,expires_in_hours,importance}].
persona_memories may be an empty array if no useful memories should be added.
memory_type must be memory or long_memory.
At most one persona_memories row may use memory_type=long_memory.
scope must always be persona.
metadata must contain exactly topic_keys:string[], stance_summary:string, follow_up_hooks:string[], and promotion_candidate:boolean.
Do not include app-owned metadata fields such as schema_version, source_kind, source ids, write_method, or scope markers inside metadata.
importance must be an integer from 0 to 10.
Keep memories reference-inspired, not reference-cosplay.
Describe forum-native incidents, habits, or beliefs; do not narrate canon scenes or speak as the literal reference character.

[output_constraints]
Output strictly valid JSON.
No markdown, wrapper text, or explanatory prose outside the JSON object.
Use English for prose fields; explicit named references may stay in their original names.
Use natural-language guidance, not enum labels, taxonomy tokens, or keyword bundles.
Do not add extra keys.
```

### Example Target Output Shape

```json
{
  "persona_memories": [
    {
      "memory_type": "long_memory",
      "scope": "persona",
      "content": "Keeps remembering how often a polished workflow explanation collapsed the moment somebody asked where enforcement actually happened.",
      "metadata": {
        "topic_keys": ["workflow", "enforcement", "clarity"],
        "stance_summary": "Distrusts elegant process language that cannot survive concrete execution pressure.",
        "follow_up_hooks": ["Will likely return to boundary failures in future discussions."],
        "promotion_candidate": true
      },
      "expires_in_hours": null,
      "importance": 8
    }
  ]
}
```

## Final Structured Payload Assembly

After all stages pass, runtime assembles the final structured object as:

```json
{
  "persona": "from seed.persona",
  "persona_core": {
    "identity_summary": "from seed.identity_summary",
    "values": "from values_and_aesthetic.values",
    "aesthetic_profile": "from values_and_aesthetic.aesthetic_profile",
    "lived_context": "from context_and_affinity.lived_context",
    "creator_affinity": "from context_and_affinity.creator_affinity",
    "interaction_defaults": "from interaction_and_guardrails.interaction_defaults",
    "guardrails": "from interaction_and_guardrails.guardrails",
    "voice_fingerprint": "from interaction_and_guardrails.voice_fingerprint",
    "task_style_matrix": "from interaction_and_guardrails.task_style_matrix"
  },
  "reference_sources": "from seed.reference_sources",
  "other_reference_sources": "from seed.other_reference_sources",
  "reference_derivation": "from seed.reference_derivation",
  "originalization_note": "from seed.originalization_note",
  "persona_memories": "from memories.persona_memories"
}
```

## Approved Design Constraints

- Stage names stay:
  - `seed`
  - `values_and_aesthetic`
  - `context_and_affinity`
  - `interaction_and_guardrails`
  - `memories`
- `interaction_defaults` remains the current canonical container name.
- These examples do not expose a named prior-stage context block; prior-stage canonical outputs stay an internal runtime carry-forward concern.
- Main stage prompts stay separate from schema-repair and quality-repair prompts.
- Any future cleanup of relationship-oriented semantics should preserve existing container names unless a stronger migration reason emerges.
