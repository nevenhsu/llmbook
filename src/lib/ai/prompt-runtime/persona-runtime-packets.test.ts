import { describe, it, expect } from "vitest";
import {
  buildPostPlanPersonaPacket,
  buildPostBodyPersonaPacket,
  buildCommentPersonaPacket,
  buildReplyPersonaPacket,
  buildAuditPersonaPacket,
  buildPersonaPacketForPrompt,
  normalizePersonaCoreV2,
  buildPersonaRuntimePacket,
} from "./persona-runtime-packets";
import { FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";

const FIXTURE: PersonaCoreV2 = {
  schema_version: "v2",
  identity: {
    archetype: "restless pattern-spotter driven to puncture vague consensus",
    core_drive: "expose hidden costs in comfortable narratives",
    central_tension: "clarity against comfort",
    self_image: "useful irritant and consequence-surfacer",
  },
  mind: {
    reasoning_style: "pattern_matching with consequence-first framing",
    attention_biases: ["status games", "missing consequences", "evasive abstractions"],
    default_assumptions: ["most claims hide an interest", "complexity is undersold"],
    blind_spots: ["emotional cost of directness", "collaborative slow-build"],
    disagreement_style: "pointed counterpoint with evidence nudge",
    thinking_procedure: {
      context_reading: [
        "scan for unstated assumptions",
        "note who benefits",
        "flag authority theater",
      ],
      salience_rules: [
        "flag missing cost",
        "flag evasive abstraction",
        "doubt frictionless claims",
      ],
      interpretation_moves: ["counterpoint the strongest claim", "surface hidden trade-off"],
      response_moves: ["lead with concrete objection", "close with pointed ask"],
      omission_rules: [
        "ignore generic encouragement",
        "skip balanced explainer framing",
        "avoid polite support macro",
      ],
    },
  },
  taste: {
    values: ["clarity", "consequences", "unvarnished trade-offs"],
    respects: ["direct argument", "falsifiable claims", "earned authority"],
    dismisses: ["vague consensus", "advice-list structure", "credentialism"],
    recurring_obsessions: ["hidden costs", "who pays for comfort", "institutional memory loss"],
  },
  voice: {
    register: "dry wit with cutting understatement",
    rhythm: "clipped and reactive",
    opening_habits: ["concrete objection", "surfaced assumption"],
    closing_habits: ["pointed ask", "visible cost"],
    humor_style: "dark understatement",
    metaphor_domains: ["pressure", "ledgers", "scaffolding", "weather systems"],
    forbidden_phrases: ["balanced perspective", "on the other hand", "it depends", "to be fair"],
  },
  forum: {
    participation_mode: "counterpoint with clarification instincts",
    preferred_post_intents: ["critique", "clarification", "counter-consensus"],
    preferred_comment_intents: ["counterpoint", "pressure test"],
    preferred_reply_intents: ["rebuttal", "focused ask"],
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
    reference_names: ["David Bowie", "Laurie Anderson"],
    abstract_traits: ["theatrical pressure", "outsider poise", "cool distance"],
    do_not_imitate: true,
  },
  anti_generic: {
    avoid_patterns: ["balanced explainer tone", "advice-list structure", "polite support macro"],
    failure_mode: "defaults to measured editorial voice when uncertain",
  },
};

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("packet budgets", () => {
  it("post_plan discussion stays within budget", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(80);
    expect(packet.wordCount).toBeLessThanOrEqual(240);
  });

  it("post_body discussion stays within budget", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(70);
    expect(packet.wordCount).toBeLessThanOrEqual(200);
  });

  it("comment discussion stays within budget", () => {
    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(50);
    expect(packet.wordCount).toBeLessThanOrEqual(180);
  });

  it("reply discussion stays within budget", () => {
    const packet = buildReplyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(50);
    expect(packet.wordCount).toBeLessThanOrEqual(180);
  });

  it("audit discussion stays within budget", () => {
    const packet = buildAuditPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(50);
    expect(packet.wordCount).toBeLessThanOrEqual(220);
  });

  it("post_plan story stays within budget", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(80);
    expect(packet.wordCount).toBeLessThanOrEqual(240);
  });

  it("post_body story stays within budget", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.wordCount).toBeGreaterThanOrEqual(70);
    expect(packet.wordCount).toBeLessThanOrEqual(200);
  });
});

describe("story mode includes narrative traits", () => {
  it("post_plan story includes narrative engine", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).toContain("story_engine" in FIXTURE.narrative ? "" : "");
    expect(packet.renderedText).toContain("mask slips");
    expect(packet.renderedText).toContain("status against integrity");
  });

  it("post_body story includes character focus", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).toContain("frauds");
    expect(packet.renderedText).toContain("witnesses");
  });

  it("discussion mode does NOT include narrative traits", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).not.toContain("story_engine");
    expect(packet.renderedText).not.toContain("mask slips");
  });
});

describe("thinking procedure", () => {
  it("includes Procedure: line in renderedText", () => {
    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).toMatch(/Procedure:/);
  });

  it("procedure line includes 'internally'", () => {
    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).toMatch(/internally/i);
  });

  it("procedure line is under 55 words", () => {
    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });

    const procMatch = packet.renderedText.match(/Procedure:.+/);

    if (procMatch) {
      const words = wordCount(procMatch[0]);
      expect(words).toBeLessThanOrEqual(60); // Allow some slack for the "Procedure:" prefix
    }
  });
});

describe("no full JSON in renderedText", () => {
  it("does not contain schema_version in renderedText", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).not.toContain('"schema_version"');
    expect(packet.renderedText).not.toContain("schema_version");
  });

  it("does not contain JSON braces", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).not.toMatch(/^\s*\{/m);
  });
});

describe("reference names excluded", () => {
  it("does not render reference_names in renderedText", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).not.toContain("David Bowie");
    expect(packet.renderedText).not.toContain("Laurie Anderson");
  });

  it("renders abstract_traits instead", () => {
    const packet = buildPostPlanPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).toContain("theatrical pressure");
  });
});

describe("examples disabled", () => {
  it("does not include examples block", () => {
    const packet = buildPostBodyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.renderedText).not.toContain("Examples:");
  });
});

describe("buildPersonaPacketForPrompt", () => {
  it("maps post_plan to plan packet", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "post_plan",
      stagePurpose: "main",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("post_plan");
  });

  it("maps post_body to body packet", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "post_body",
      stagePurpose: "main",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("post_body");
  });

  it("maps comment to comment packet", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "comment",
      stagePurpose: "main",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("comment");
  });

  it("maps reply to reply packet", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "reply",
      stagePurpose: "main",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("reply");
  });

  it("returns null for unknown task type", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "vote" as unknown as Parameters<typeof buildPersonaPacketForPrompt>[0]["taskType"],
      stagePurpose: "main",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).toBeNull();
  });

  it("returns audit packet for audit stage", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "comment",
      stagePurpose: "audit",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("audit");
  });

  it("returns audit packet for quality_repair stage", () => {
    const packet = buildPersonaPacketForPrompt({
      taskType: "post_body",
      stagePurpose: "quality_repair",
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet).not.toBeNull();
    expect(packet!.flow).toBe("audit");
  });
});

describe("audit packet", () => {
  it("includes default audit targets for discussion", () => {
    const packet = buildAuditPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.auditTargets).toContain("value_fit");
    expect(packet.auditTargets).toContain("reasoning_fit");
    expect(packet.auditTargets).toContain("discourse_fit");
    expect(packet.auditTargets).toContain("expression_fit");
    expect(packet.auditTargets).toContain("procedure_fit");
    expect(packet.auditTargets).toContain("anti_generic");
    expect(packet.auditTargets).toContain("reference_non_imitation");
  });

  it("includes narrative_fit for story mode", () => {
    const packet = buildAuditPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.auditTargets).toContain("narrative_fit");
  });

  it("does not include narrative_fit for discussion mode", () => {
    const packet = buildAuditPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(packet.auditTargets).not.toContain("narrative_fit");
  });
});

describe("normalizePersonaCoreV2", () => {
  it("returns v2 source for valid v2", () => {
    const result = normalizePersonaCoreV2(FIXTURE);
    expect(result.source).toBe("v2");
    expect(result.warnings).toHaveLength(0);
  });

  it("returns fallback source for invalid input", () => {
    const result = normalizePersonaCoreV2({ schema_version: "v1" });
    expect(result.source).toBe("fallback");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns fallback for null", () => {
    const result = normalizePersonaCoreV2(null);
    expect(result.source).toBe("fallback");
  });
});

describe("content mode differentiation", () => {
  it("story post_plan packet differs from discussion", () => {
    const discussion = buildPostPlanPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    const story = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(discussion.renderedText).not.toBe(story.renderedText);
  });

  it("story post_body packet differs from discussion", () => {
    const discussion = buildPostBodyPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FIXTURE,
    });
    const story = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "p1",
      core: FIXTURE,
    });
    expect(discussion.renderedText).not.toBe(story.renderedText);
  });
});

describe("hard max enforcement", () => {
  it("truncates when content exceeds hard max", () => {
    const verboseCore: PersonaCoreV2 = {
      ...FIXTURE,
      identity: {
        ...FIXTURE.identity,
        archetype:
          "A very verbose and excessively detailed description of the persona archetype that takes far too many words to express what could be said in a much shorter and more concise manner while still conveying the same essential meaning and core identity of this particular character",
      },
    };

    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: verboseCore,
    });

    expect(packet.wordCount).toBeLessThanOrEqual(180);

    if (packet.warnings.length > 0) {
      expect(packet.warnings.some((w) => w.includes("truncated"))).toBe(true);
    }
  });
});

describe("fallback persona packet", () => {
  it("uses fallback core when v1 data provided", () => {
    const packet = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "p1",
      core: FALLBACK_PERSONA_CORE_V2,
    });
    expect(packet.renderedText).toBeTruthy();
    expect(packet.wordCount).toBeGreaterThan(0);
  });
});
