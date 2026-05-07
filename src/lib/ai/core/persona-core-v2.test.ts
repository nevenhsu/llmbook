import { describe, it, expect } from "vitest";
import {
  validatePersonaCoreV2,
  parsePersonaCoreV2,
  FALLBACK_PERSONA_CORE_V2,
} from "./persona-core-v2";
import type { PersonaCoreV2 } from "./persona-core-v2";

function makeValidV2(): PersonaCoreV2 {
  return {
    schema_version: "v2",
    identity: {
      archetype: "restless pattern-spotter",
      core_drive: "puncture vague consensus",
      central_tension: "clarity against comfort",
      self_image: "a useful irritant",
    },
    mind: {
      reasoning_style: "pattern_matching",
      attention_biases: ["status games", "missing consequences"],
      default_assumptions: ["most claims hide an interest", "complexity is undersold"],
      blind_spots: ["emotional cost of directness"],
      disagreement_style: "pointed counterpoint",
      thinking_procedure: {
        context_reading: ["scan for unstated assumptions", "note who benefits"],
        salience_rules: ["flag missing cost", "flag evasive abstraction"],
        interpretation_moves: ["counterpoint the strongest claim", "surface hidden trade-off"],
        response_moves: ["lead with concrete objection", "close with pointed ask"],
        omission_rules: ["ignore generic encouragement", "skip balanced explainer framing"],
      },
    },
    taste: {
      values: ["clarity", "consequences", "unvarnished trade-offs"],
      respects: ["direct argument", "falsifiable claims"],
      dismisses: ["vague consensus", "advice-list structure"],
      recurring_obsessions: ["hidden costs", "who pays for comfort"],
    },
    voice: {
      register: "dry wit",
      rhythm: "clipped",
      opening_habits: ["concrete objection"],
      closing_habits: ["pointed ask"],
      humor_style: "dark understatement",
      metaphor_domains: ["pressure", "ledgers"],
      forbidden_phrases: ["balanced perspective", "on the other hand", "it depends"],
    },
    forum: {
      participation_mode: "counterpoint",
      preferred_post_intents: ["critique", "clarification"],
      preferred_comment_intents: ["counterpoint"],
      preferred_reply_intents: ["rebuttal"],
      typical_lengths: {
        post: "medium",
        comment: "short",
        reply: "short",
      },
    },
    narrative: {
      story_engine: "pressure people until the mask slips",
      favored_conflicts: ["status against integrity", "truth against comfort"],
      character_focus: ["frauds", "witnesses"],
      emotional_palette: ["tension", "disgust", "reluctant respect"],
      plot_instincts: ["raise stakes through exposure", "reward honest failure"],
      scene_detail_biases: ["social micro-signals", "objects with history"],
      ending_preferences: ["uncomfortable clarity", "cost made visible"],
      avoid_story_shapes: ["redemption arc", "heroic triumph", "moral lesson"],
    },
    reference_style: {
      reference_names: ["David Bowie"],
      abstract_traits: ["theatrical pressure", "outsider poise"],
      do_not_imitate: true,
    },
    anti_generic: {
      avoid_patterns: ["balanced explainer tone", "advice-list structure", "polite support macro"],
      failure_mode: "defaults to measured editorial voice when uncertain",
    },
  };
}

describe("validatePersonaCoreV2", () => {
  it("parses a valid compact v2", () => {
    const result = validatePersonaCoreV2(makeValidV2());
    expect("core" in result).toBe(true);
    if ("core" in result) {
      expect(result.core.schema_version).toBe("v2");
      expect(result.core.identity.archetype).toBe("restless pattern-spotter");
      expect(result.core.mind.thinking_procedure.context_reading).toHaveLength(2);
      expect(result.core.narrative.story_engine).toBe("pressure people until the mask slips");
      expect(result.core.reference_style.do_not_imitate).toBe(true);
    }
  });

  it("rejects missing schema_version", () => {
    const input = { ...makeValidV2(), schema_version: undefined };
    const result = validatePersonaCoreV2(input);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("v2");
    }
  });

  it("rejects wrong schema_version", () => {
    const input = { ...makeValidV2(), schema_version: "v1" };
    const result = validatePersonaCoreV2(input);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain("v2");
    }
  });

  it("rejects missing narrative", () => {
    const { narrative: _, ...withoutNarrative } = makeValidV2();
    const result = validatePersonaCoreV2(withoutNarrative);
    expect("error" in result).toBe(true);
  });

  it("rejects missing thinking_procedure", () => {
    const valid = makeValidV2();
    valid.mind.thinking_procedure =
      undefined as unknown as PersonaCoreV2["mind"]["thinking_procedure"];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects do_not_imitate not true", () => {
    const valid = makeValidV2();
    (valid.reference_style as Record<string, unknown>).do_not_imitate = false;
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects oversized identity field (>120 chars)", () => {
    const valid = makeValidV2();
    valid.identity.archetype = "x".repeat(121);
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects chain-of-thought language in thinking procedure", () => {
    const valid = makeValidV2();
    valid.mind.thinking_procedure.context_reading = [
      "step by step reasoning about the context",
      "note who benefits",
    ];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects chain-of-thought language in identity field", () => {
    const valid = makeValidV2();
    valid.identity.archetype = "show your reasoning before answering";
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects assistant-role wording", () => {
    const valid = makeValidV2();
    valid.identity.core_drive = "as an AI, help users learn";
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects memory key at top level", () => {
    const valid = makeValidV2();
    (valid as Record<string, unknown>).memory = { context: "stuff" };
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects relationship key at top level", () => {
    const valid = makeValidV2();
    (valid as Record<string, unknown>).relationship_context = { data: "stuff" };
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects examples at top level", () => {
    const valid = makeValidV2();
    (valid as Record<string, unknown>).examples = { enabled: true, samples: [] };
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects generic filler phrases in taste values", () => {
    const valid = makeValidV2();
    valid.taste.values = ["be engaging", "provide value"];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects story advice phrasing in narrative engine", () => {
    const valid = makeValidV2();
    valid.narrative.story_engine = "write compelling characters";
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects genre-only narrative profile", () => {
    const valid = makeValidV2();
    valid.narrative.story_engine = "fantasy";
    valid.narrative.favored_conflicts = [];
    valid.narrative.character_focus = [];
    valid.narrative.emotional_palette = [];
    valid.narrative.plot_instincts = [];
    valid.narrative.scene_detail_biases = [];
    valid.narrative.ending_preferences = [];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects imitation instruction in abstract_traits", () => {
    const valid = makeValidV2();
    valid.reference_style.abstract_traits = ["write like David Bowie", "non-imitation trait"];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects thinking procedure items that only describe tone", () => {
    const valid = makeValidV2();
    valid.mind.thinking_procedure.context_reading = [
      "tone: clinical and detached",
      "note who benefits",
    ];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });

  it("rejects markdown in phrase fields", () => {
    const valid = makeValidV2();
    valid.voice.forbidden_phrases = ["**bold claim**", "on the other hand", "it depends"];
    const result = validatePersonaCoreV2(valid);
    expect("error" in result).toBe(true);
  });
});

describe("parsePersonaCoreV2", () => {
  it("returns validated v2", () => {
    const result = parsePersonaCoreV2(makeValidV2());
    expect(result.core.schema_version).toBe("v2");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns fallback for non-object input", () => {
    const result = parsePersonaCoreV2("not an object");
    expect(result.core.schema_version).toBe("v2");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("fallback");
  });

  it("returns fallback for null input", () => {
    const result = parsePersonaCoreV2(null);
    expect(result.core).toEqual(FALLBACK_PERSONA_CORE_V2);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns fallback for v1-shaped input", () => {
    const result = parsePersonaCoreV2({
      identity_summary: { archetype: "old format" },
      voice_fingerprint: {},
    });
    expect(result.core.schema_version).toBe("v2");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("ignores unknown keys in v2 data", () => {
    const valid = makeValidV2();
    (valid as Record<string, unknown>).extra_field = "should be ignored";
    const result = validatePersonaCoreV2(valid);
    expect("core" in result).toBe(true);
    if ("core" in result) {
      expect(result.core.schema_version).toBe("v2");
    }
  });
});

describe("FALLBACK_PERSONA_CORE_V2", () => {
  it("is a valid v2 persona", () => {
    const result = validatePersonaCoreV2(FALLBACK_PERSONA_CORE_V2);
    expect("core" in result).toBe(true);
  });

  it("has do_not_imitate true", () => {
    expect(FALLBACK_PERSONA_CORE_V2.reference_style.do_not_imitate).toBe(true);
  });

  it("has narrative", () => {
    expect(FALLBACK_PERSONA_CORE_V2.narrative.story_engine).toBeTruthy();
    expect(FALLBACK_PERSONA_CORE_V2.narrative.favored_conflicts.length).toBeGreaterThan(0);
  });

  it("has thinking procedure", () => {
    expect(FALLBACK_PERSONA_CORE_V2.mind.thinking_procedure.context_reading.length).toBeGreaterThan(
      0,
    );
  });
});
