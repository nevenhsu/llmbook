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

function buildPersonaSeedStage() {
  return {
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
  };
}

describe("persona-generation-contract", () => {
  it("parses seed output with separate personality-bearing and other reference sources", () => {
    const parsed = parsePersonaSeedOutput(JSON.stringify(buildPersonaSeedStage()));

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

  it("parses seed quality repair output with author references and compact contribution arrays", () => {
    const parsed = parsePersonaSeedOutput(
      JSON.stringify({
        persona: {
          display_name: "S. K. Edwards",
          bio: "Forum regular and writer who reads threads like short stories, searching for the quiet grief beneath the argument.",
          status: "active",
        },
        identity_summary: {
          archetype:
            "Quiet dissector who opens with an observation and unravels the emotional subtext beneath the surface.",
          core_motivation: "To uncover the hidden emotional weight behind surface-level claims.",
          one_sentence_identity:
            "A forum participant who brings a novelist's eye for memory and metaphor into discussion.",
        },
        reference_sources: [
          {
            name: "Chimamanda Ngozi Adichie",
            type: "author",
            contribution: ["unflinching social clarity", "intimate political insight"],
          },
          {
            name: "Haruki Murakami",
            type: "author",
            contribution: ["surreal solitude", "memory as metaphor"],
          },
          {
            name: "Kazuo Ishiguro",
            type: "author",
            contribution: ["restrained emotional gravity", "unreliable memory as narrative device"],
          },
        ],
        other_reference_sources: [
          {
            name: "Half of a Yellow Sun",
            type: "novel",
            contribution: [
              "personal relationships under political violence",
              "clarity on systemic injustice",
            ],
          },
        ],
        reference_derivation: [
          "Adopts Adichie's social clarity to dissect forum arguments.",
          "Uses Murakami's surreal solitude and Ishiguro's restraint to frame personal anecdotes.",
        ],
        originalization_note:
          "Persona is an original forum member who channels the emotional depth of these authors without imitating their biographies or writing careers.",
      }),
    );

    expect(parsed.reference_sources).toHaveLength(3);
    expect(parsed.persona.display_name).toBe("S. K. Edwards");
  });

  it("parses seed quality repair output with showrunner and screenwriter references", () => {
    const parsed = parsePersonaSeedOutput(
      JSON.stringify({
        persona: {
          display_name: "TessMosaic",
          bio: "A forum regular who deconstructs TV shows through fragmented memory and rewrites scenes live in threads.",
          status: "active",
        },
        identity_summary: {
          archetype: "The Fragmented Narrator",
          core_motivation:
            "To explore how TV storytelling mirrors the unreliability of human memory",
          one_sentence_identity:
            "A poster who dissects shows by emotional beats and narrative gaps, not plot summaries.",
        },
        reference_sources: [
          {
            name: "David Milch",
            type: "showrunner",
            contribution: ["poetic, raw dialogue", "moral complexity"],
          },
          {
            name: "Ronald D. Moore",
            type: "showrunner",
            contribution: ["grounded sci-fi as character drama", "serialized long-form arcs"],
          },
          {
            name: "Charlie Kaufman",
            type: "screenwriter",
            contribution: ["unreliable narration as structure", "identity fragmentation themes"],
          },
        ],
        other_reference_sources: [
          {
            name: "The Leftovers",
            type: "television series",
            contribution: ["slow-burn emotional ambiguity", "loss as narrative fuel"],
          },
          {
            name: "Eternal Sunshine of the Spotless Mind",
            type: "film",
            contribution: ["nonlinear memory as emotional rhythm", "fractured romance"],
          },
        ],
        reference_derivation: [
          "Combines Milch's raw dialogue with Kaufman's meta-narrative structure.",
          "Applies memory-jump pacing from Eternal Sunshine to ensemble TV arcs where characters disagree on events.",
        ],
        originalization_note:
          "Stripped professional credits and reframed as a forum-native identity focused on live scene dissection and rewriting, treating each post as personal craft rather than industry work.",
      }),
    );

    expect(parsed.reference_sources).toHaveLength(3);
    expect(parsed.persona.display_name).toBe("TessMosaic");
  });

  it("parses the simplified persona_core stage output", () => {
    const parsed = parsePersonaCoreStageOutput(JSON.stringify(buildPersonaCoreStage()));

    expect(parsed.values).toEqual(buildPersonaCoreStage().values);
    expect(parsed.voice_fingerprint).toEqual(buildPersonaCoreStage().voice_fingerprint);
  });

  it("rejects wrapped seed output", () => {
    expect(() => parsePersonaSeedOutput(JSON.stringify({ seed: buildPersonaSeedStage() }))).toThrow(
      /forbidden key seed/,
    );
  });

  it("rejects fenced JSON for canonical seed and persona_core stages", () => {
    expect(() =>
      parsePersonaSeedOutput(`\`\`\`json\n${JSON.stringify(buildPersonaSeedStage())}\n\`\`\``),
    ).toThrow(/must be a raw JSON object/);
    expect(() =>
      parsePersonaCoreStageOutput(`\`\`\`json\n${JSON.stringify(buildPersonaCoreStage())}\n\`\`\``),
    ).toThrow(/must be a raw JSON object/);
  });

  it("rejects unknown persona seed status instead of coercing it", () => {
    const seed = buildPersonaSeedStage();
    seed.persona.status = "draft";
    expect(() => parsePersonaSeedOutput(JSON.stringify(seed))).toThrow(
      /persona.status must be active or inactive/,
    );
  });

  it("rejects direct doctrine fit keys in persona_core output", () => {
    expect(() =>
      parsePersonaCoreStageOutput(
        JSON.stringify({
          ...buildPersonaCoreStage(),
          value_fit: ["clarity"],
        }),
      ),
    ).toThrow(/forbidden key value_fit/);
  });

  it("rejects retired persona_core aliases", () => {
    const withoutCreatorAffinity = buildPersonaCoreStage();
    delete (withoutCreatorAffinity as Partial<ReturnType<typeof buildPersonaCoreStage>>)
      .creator_affinity;
    expect(() =>
      parsePersonaCoreStageOutput(
        JSON.stringify({
          ...withoutCreatorAffinity,
          creator_admiration: buildPersonaCoreStage().creator_affinity,
        }),
      ),
    ).toThrow(/forbidden key creator_admiration/);

    const core = buildPersonaCoreStage();
    const commentWithoutFeedbackShape = { ...core.task_style_matrix.comment };
    delete (commentWithoutFeedbackShape as Partial<typeof core.task_style_matrix.comment>)
      .feedback_shape;
    expect(() =>
      parsePersonaCoreStageOutput(
        JSON.stringify({
          ...core,
          task_style_matrix: {
            ...core.task_style_matrix,
            comment: {
              ...commentWithoutFeedbackShape,
              body_shape: "Old compatibility alias.",
            },
          },
        }),
      ),
    ).toThrow(/forbidden key body_shape/);
  });

  it("rejects forbidden nested persona_core keys", () => {
    expect(() =>
      parsePersonaCoreStageOutput(
        JSON.stringify({
          ...buildPersonaCoreStage(),
          values: {
            ...buildPersonaCoreStage().values,
            extra_priority_hint: "not allowed",
          },
        }),
      ),
    ).toThrow(/persona_core.values contains forbidden key extra_priority_hint/);
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

  it("rejects semantic audit responses with extra top-level keys", () => {
    expect(() =>
      parsePersonaGenerationSemanticAuditResult(
        JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          summary: "not allowed",
        }),
      ),
    ).toThrow(/semantic audit contains forbidden key summary/);
  });
});
