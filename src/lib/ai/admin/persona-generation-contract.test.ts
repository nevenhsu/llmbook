import { describe, expect, it } from "vitest";
import {
  parsePersonaGenerationOutput,
  parsePersonaInteractionOutput,
  parsePersonaGenerationSemanticAuditResult,
  parsePersonaSeedOutput,
} from "@/lib/ai/admin/persona-generation-contract";

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

  it("parses final structured output with other_reference_sources preserved", () => {
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
        persona_memories: [],
      }),
    ).structured;

    expect(parsed.reference_sources).toHaveLength(1);
    expect(parsed.other_reference_sources).toEqual([
      expect.objectContaining({
        name: "prototyping philosophy",
      }),
    ]);
  });

  it("parses semantic audit results that keep only the valid personality-bearing references", () => {
    expect(
      parsePersonaGenerationSemanticAuditResult(
        JSON.stringify({
          passes: true,
          keptReferenceNames: ["Shigeru Miyamoto"],
          issues: [],
          repairGuidance: [],
        }),
      ),
    ).toEqual({
      passes: true,
      keptReferenceNames: ["Shigeru Miyamoto"],
      issues: [],
      repairGuidance: [],
    });
  });

  it("accepts comment.body_shape as a stage-local alias for comment.feedback_shape", () => {
    const parsed = parsePersonaInteractionOutput(
      JSON.stringify({
        interaction_defaults: {
          default_stance: "Frames the thread through mythic function before addressing specifics.",
          discussion_strengths: ["Connects arguments to broader narrative purpose."],
          friction_triggers: ["Literal plot-hole complaints without thematic framing."],
          non_generic_traits: ["Pivots into parables about protecting creative vision."],
        },
        guardrails: {
          hard_no: ["Will not flatten stories into spreadsheet logic."],
          deescalation_style: ["Retreats into archetypal framing instead of direct escalation."],
        },
        voice_fingerprint: {
          opening_move: "Open with a mythic or serial-era framing move.",
          metaphor_domains: ["Myth cycles", "Vintage adventure serials"],
          attack_style: "Dismiss shallow critique as noise that misses the archetypal core.",
          praise_style: "Describe good work as mythically resonant and structurally daring.",
          closing_move: "Leave behind a parable about creative vision.",
          forbidden_shapes: ["Technical nitpicking without narrative stakes."],
        },
        task_style_matrix: {
          post: {
            entry_shape: "Start from mythic framing.",
            body_shape: "Connect the topic back to narrative design intent.",
            close_shape: "End with a parable about creative conviction.",
            forbidden_shapes: ["Plot-summary recap."],
          },
          comment: {
            entry_shape: "Reframe the reply through archetypal purpose.",
            body_shape: "Deflect the literal objection into a mythic principle.",
            close_shape: "Close with a lofty statement about vision.",
            forbidden_shapes: ["Production-schedule detail."],
          },
        },
      }),
    );

    const commentMatrix = parsed.task_style_matrix.comment as {
      feedback_shape: string;
    };
    expect(commentMatrix.feedback_shape).toBe(
      "Deflect the literal objection into a mythic principle.",
    );
  });
});
