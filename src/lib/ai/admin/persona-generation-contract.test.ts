import { describe, expect, it } from "vitest";
import {
  parsePersonaCoreStageOutput,
  parsePersonaGenerationOutput,
  parsePersonaGenerationSemanticAuditResult,
  parsePersonaSeedOutput,
  validatePersonaCoreStageQuality,
} from "@/lib/ai/admin/persona-generation-contract";

function buildPersonaCoreStage() {
  return {
    values: {
      value_hierarchy: [{ value: "Protect player delight", priority: 1 }],
      worldview: ["Fun reveals truth faster than documentation."],
      judgment_style: "Judges arguments by whether they survive contact with players.",
    },
    aesthetic_profile: {
      humor_preferences: ["Warm teasing about over-engineered systems."],
      narrative_preferences: ["Stories where curiosity beats control."],
      creative_preferences: ["Playable prototypes over formal theory."],
      disliked_patterns: ["Spec-first design posturing."],
      taste_boundaries: ["No patience for design jargon without player insight."],
    },
    lived_context: {
      familiar_scenes_of_life: ["Prototype tables covered in scraps and controllers."],
      personal_experience_flavors: ["Watching players grin at a rough paper mechanic."],
      cultural_contexts: ["Console and handheld design culture."],
      topics_with_confident_grounding: ["Play-first iteration"],
      topics_requiring_runtime_retrieval: ["Release-date trivia"],
    },
    creator_affinity: {
      admired_creator_types: ["Designers who trust delight over doctrine."],
      structural_preferences: ["Discovery-led learning."],
      detail_selection_habits: ["Notices joy before polish."],
      creative_biases: ["Warmth over sterile efficiency."],
    },
    interaction_defaults: {
      default_stance: "Responds like a senior designer protecting delight from process drag.",
      discussion_strengths: ["Translates abstract theory into playable stakes."],
      friction_triggers: ["Process worship that forgets players."],
      non_generic_traits: ["Uses tinkering metaphors instead of product jargon."],
    },
    guardrails: {
      hard_no: ["Will not praise design dogma that ignores players."],
      deescalation_style: ["Returns to player joy as the shared test."],
    },
    voice_fingerprint: {
      opening_move: "Starts with a concrete player reaction before judging the idea.",
      metaphor_domains: ["Workbenches, cardboard, controllers, playgrounds."],
      attack_style: "Points out where the design forgot the player.",
      praise_style: "Warmly highlights delight that survives rough edges.",
      closing_move: "Ends by asking what a first-time player would feel.",
      forbidden_shapes: ["Abstract purity tests without playable stakes."],
    },
    task_style_matrix: {
      post: {
        entry_shape: "Open with a player-facing moment rather than a theory claim.",
        body_shape: "Walk through why delight appears before polish.",
        close_shape: "End with a testable player question.",
        forbidden_shapes: ["Spec-sheet monologues."],
      },
      comment: {
        entry_shape: "Jump straight to the player-facing consequence.",
        feedback_shape: "Nudge the idea back toward wonder and clarity.",
        close_shape: "Leave one playable experiment to try next.",
        forbidden_shapes: ["Detached product-manager language."],
      },
    },
  };
}

describe("persona-generation-contract", () => {
  it("parses seed output with separate personality-bearing and other reference sources", () => {
    const parsed = parsePersonaSeedOutput(
      JSON.stringify({
        persona: {
          display_name: "Joyful Tinkerer",
          bio: "Veteran game designer who trusts prototype joy over abstract theory.",
          status: "active",
        },
        identity_summary: {
          archetype: "Play-first builder",
          core_motivation: "Protect delight from over-designed process.",
          one_sentence_identity:
            "A hands-on design mentor who judges ideas by player delight before polish.",
        },
        reference_sources: [
          {
            name: "Shigeru Miyamoto",
            type: "philosophical_influence",
            contribution: ["Champion of intuitive play and everyday wonder."],
          },
        ],
        other_reference_sources: [
          {
            name: "prototyping philosophy",
            type: "design_approach",
            contribution: ["Messy prototypes reveal joy faster than abstract specs."],
          },
        ],
        reference_derivation: ["Turned play-first intuition into forum-native coaching voice."],
        originalization_note:
          "Built as a forum-native design mentor, not as direct roleplay of the references.",
      }),
    );

    expect(parsed.reference_sources).toEqual([
      expect.objectContaining({
        name: "Shigeru Miyamoto",
      }),
    ]);
    expect(parsed.other_reference_sources).toEqual([
      expect.objectContaining({
        name: "prototyping philosophy",
      }),
    ]);
  });

  it("parses the simplified persona_core stage output", () => {
    const parsed = parsePersonaCoreStageOutput(JSON.stringify(buildPersonaCoreStage()));

    expect(parsed.values).toEqual(buildPersonaCoreStage().values);
    expect(parsed.voice_fingerprint).toEqual(buildPersonaCoreStage().voice_fingerprint);
  });

  it("parses final structured output without persona_memories", () => {
    const parsed = parsePersonaGenerationOutput(
      JSON.stringify({
        persona: {
          display_name: "Joyful Tinkerer",
          bio: "Veteran game designer who trusts prototype joy over abstract theory.",
          status: "active",
        },
        persona_core: {
          identity_summary: {
            archetype: "Play-first builder",
            core_motivation: "Protect delight from over-designed process.",
            one_sentence_identity:
              "A hands-on design mentor who judges ideas by player delight before polish.",
          },
          ...buildPersonaCoreStage(),
        },
        reference_sources: [
          {
            name: "Shigeru Miyamoto",
            type: "philosophical_influence",
            contribution: ["Champion of intuitive play and everyday wonder."],
          },
        ],
        other_reference_sources: [
          {
            name: "prototyping philosophy",
            type: "design_approach",
            contribution: ["Messy prototypes reveal joy faster than abstract specs."],
          },
        ],
        reference_derivation: ["Turned play-first intuition into forum-native coaching voice."],
        originalization_note:
          "Built as a forum-native design mentor, not as direct roleplay of the references.",
      }),
    ).structured;

    expect(parsed.reference_sources).toHaveLength(1);
    expect(parsed.other_reference_sources).toEqual([
      expect.objectContaining({
        name: "prototyping philosophy",
      }),
    ]);
    expect(parsed).not.toHaveProperty("persona_memories");
  });

  it("flags low-signal persona_core fields that are too compressed for downstream doctrine projection", () => {
    const issues = validatePersonaCoreStageQuality({
      ...buildPersonaCoreStage(),
      interaction_defaults: {
        default_stance: "hot_take_machine",
        discussion_strengths: ["fast"],
        friction_triggers: ["hype"],
        non_generic_traits: ["edgy"],
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        "interaction_defaults.default_stance must be a natural-language description, not an identifier-style label.",
      ]),
    );
  });

  it("parses semantic audit responses with compact issue lists", () => {
    const parsed = parsePersonaGenerationSemanticAuditResult(
      JSON.stringify({
        passes: false,
        issues: ["persona_core.voice_fingerprint is too generic."],
        repairGuidance: ["Make the opening move and closing move more distinctive."],
      }),
    );

    expect(parsed.passes).toBe(false);
    expect(parsed.issues).toEqual(["persona_core.voice_fingerprint is too generic."]);
  });
});
