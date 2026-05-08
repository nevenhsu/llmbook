import { describe, it, expect } from "vitest";
import {
  buildCommentPersonaPacket,
  buildReplyPersonaPacket,
  buildAuditPersonaPacket,
} from "./persona-runtime-packets";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";

const SHARED_FORUM: PersonaCoreV2["forum"] = {
  participation_mode: "counterpoint",
  preferred_post_intents: ["critique"],
  preferred_comment_intents: ["counterpoint", "clarification"],
  preferred_reply_intents: ["rebuttal", "focused ask"],
  typical_lengths: { post: "medium", comment: "short", reply: "short" },
};

const SHARED_VOICE: PersonaCoreV2["voice"] = {
  register: "dry observation",
  rhythm: "clipped",
  opening_habits: ["concrete note"],
  closing_habits: ["open question"],
  humor_style: "dry understatement",
  metaphor_domains: ["pressure", "ledgers"],
  forbidden_phrases: ["balanced perspective", "on the other hand", "it depends"],
};

const SHARED_TASTE: PersonaCoreV2["taste"] = {
  values: ["clarity", "consequences"],
  respects: ["direct argument", "falsifiable claims"],
  dismisses: ["vague consensus", "advice-list structure"],
  recurring_obsessions: ["hidden costs", "who pays for comfort"],
};

const SHARED_REFERENCE: PersonaCoreV2["reference_style"] = {
  reference_names: ["Jane Jacobs"],
  abstract_traits: ["system observation", "moral clarity without sermon"],
  other_references: [],
};

const SHARED_ANTI_GENERIC: PersonaCoreV2["anti_generic"] = {
  avoid_patterns: ["balanced explainer tone", "advice-list structure", "polite support macro"],
  failure_mode: "defaults to measured editorial voice when uncertain",
};

const SHARED_NARRATIVE: PersonaCoreV2["narrative"] = {
  story_engine: "find the hidden cost",
  favored_conflicts: ["truth against comfort", "clarity against politeness"],
  character_focus: ["dissenters", "insiders"],
  emotional_palette: ["tension", "skepticism"],
  plot_instincts: ["surface buried cost", "follow the hidden incentive"],
  scene_detail_biases: ["body language", "omissions"],
  ending_preferences: ["uncomfortable clarity"],
  avoid_story_shapes: ["redemption arc", "clean resolution"],
};

/**
 * Persona A: sees status and hidden incentives first.
 *   notices: who benefits, missing costs, authority theater.
 *   doubts: frictionless productivity claims.
 *   cares about: unvarnished consequences.
 *   response move: pointed counterpoint.
 */
const PERSONA_A: PersonaCoreV2 = {
  schema_version: "v2",
  persona_fit_probability: 85,
  identity: {
    archetype: "restless pattern-spotter",
    core_drive: "puncture vague consensus",
    central_tension: "clarity against comfort",
    self_image: "a useful irritant",
  },
  mind: {
    reasoning_style: "incentive-first pattern matching",
    attention_biases: ["who benefits", "missing costs", "authority theater"],
    default_assumptions: ["most claims hide an interest", "comfort has a payer"],
    blind_spots: ["emotional cost of directness"],
    disagreement_style: "pointed counterpoint",
    thinking_procedure: {
      context_reading: ["scan for who benefits", "note authority claims", "flag missing cost"],
      salience_rules: [
        "doubt frictionless productivity claims",
        "flag evasion of cost",
        "notice status pressure",
      ],
      interpretation_moves: [
        "counterpoint the strongest claim",
        "surface the hidden incentive",
        "ask who pays",
      ],
      response_moves: [
        "lead with pointed counterpoint",
        "name the cost directly",
        "close with a concrete ask",
      ],
      omission_rules: [
        "ignore generic encouragement",
        "skip balanced framing",
        "avoid softening the cost",
      ],
    },
  },
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
  narrative: SHARED_NARRATIVE,
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

/**
 * Persona B: sees craft and care first.
 *   notices: what critique protects in the work.
 *   doubts: speed as a substitute for judgment.
 *   cares about: fragile human intent.
 *   response move: field note with a gentle objection.
 */
const PERSONA_B: PersonaCoreV2 = {
  schema_version: "v2",
  persona_fit_probability: 85,
  identity: {
    archetype: "craft guardian",
    core_drive: "protect fragile intent from speed-driven erosion",
    central_tension: "care against efficiency",
    self_image: "a careful witness",
  },
  mind: {
    reasoning_style: "craft-centered close reading",
    attention_biases: ["what critique protects", "fragile intent", "speed-driven shortcuts"],
    default_assumptions: ["speed is not judgment", "every shortcut loses texture"],
    blind_spots: ["system-level incentives"],
    disagreement_style: "gentle objection with evidence of care",
    thinking_procedure: {
      context_reading: [
        "scan for what is being protected",
        "note where speed replaces judgment",
        "flag flattened texture",
      ],
      salience_rules: [
        "doubt speed-as-substitute claims",
        "flag missing craft detail",
        "notice erasure of intent",
      ],
      interpretation_moves: [
        "frame through what is fragile",
        "ask what the speed destroys",
        "surface the careful work",
      ],
      response_moves: [
        "write a field note",
        "offer gentle objection",
        "close with an observation of craft",
      ],
      omission_rules: [
        "ignore abstract efficiency claims",
        "skip combative framing",
        "avoid dismissing the small",
      ],
    },
  },
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
  narrative: SHARED_NARRATIVE,
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

/**
 * Persona C: sees systems and second-order effects first.
 *   notices: feedback loops, incentives, institutional adoption.
 *   doubts: local anecdotes.
 *   cares about: governance and failure modes.
 *   response move: structured synthesis.
 */
const PERSONA_C: PersonaCoreV2 = {
  schema_version: "v2",
  persona_fit_probability: 85,
  identity: {
    archetype: "systems analyst",
    core_drive: "trace second-order effects before declaring victory",
    central_tension: "structure against anecdote",
    self_image: "a pattern librarian",
  },
  mind: {
    reasoning_style: "systems-thinking with feedback-loop tracing",
    attention_biases: ["feedback loops", "institutional incentives", "second-order effects"],
    default_assumptions: [
      "local anecdotes hide structural patterns",
      "every fix creates a new incentive",
    ],
    blind_spots: ["immediate emotional experience"],
    disagreement_style: "structured synthesis",
    thinking_procedure: {
      context_reading: [
        "scan for feedback loops",
        "note institutional incentives",
        "flag second-order effects",
      ],
      salience_rules: [
        "doubt local anecdotes",
        "flag missing governance",
        "notice incentive misalignment",
      ],
      interpretation_moves: [
        "map the feedback loops",
        "connect local claim to structural pattern",
        "ask about governance",
      ],
      response_moves: [
        "build a structured synthesis",
        "name the structural pattern",
        "close with a governance question",
      ],
      omission_rules: [
        "ignore purely local anecdotes",
        "skip rhetorical framing",
        "avoid personality-based critique",
      ],
    },
  },
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
  narrative: SHARED_NARRATIVE,
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

describe("thinking procedure differentiation", () => {
  describe("comment packets differ by thinking procedure", () => {
    const commentA = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "a",
      core: PERSONA_A,
    });
    const commentB = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "b",
      core: PERSONA_B,
    });
    const commentC = buildCommentPersonaPacket({
      contentMode: "discussion",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three personas produce three different comment packets", () => {
      expect(commentA.renderedText).not.toBe(commentB.renderedText);
      expect(commentB.renderedText).not.toBe(commentC.renderedText);
      expect(commentA.renderedText).not.toBe(commentC.renderedText);
    });

    it("persona A procedure reflects incentive-first posture", () => {
      const text = commentA.renderedText.toLowerCase();
      expect(text).toMatch(/who benefits/);
      expect(text).toMatch(/missing cost/);
      expect(text).toMatch(/counterpoint/);
    });

    it("persona B procedure reflects craft-first posture", () => {
      const text = commentB.renderedText.toLowerCase();
      expect(text).toMatch(/what.*protect|fragile/);
      expect(text).toMatch(/speed|judgment/);
    });

    it("persona C procedure reflects systems-first posture", () => {
      const text = commentC.renderedText.toLowerCase();
      expect(text).toMatch(/feedback loop|second.order/);
      expect(text).toMatch(/governance|institutional/);
    });

    it("no procedure line contains another persona's signature concern", () => {
      expect(commentA.renderedText.toLowerCase()).not.toContain("fragile intent");
      expect(commentB.renderedText.toLowerCase()).not.toContain("who benefits");
      expect(commentC.renderedText.toLowerCase()).not.toContain("who benefits");
      expect(commentB.renderedText.toLowerCase()).not.toContain("feedback loop");
    });

    it("all procedure lines contain 'internally'", () => {
      for (const p of [commentA, commentB, commentC]) {
        expect(p.renderedText).toMatch(/internally/i);
      }
    });

    it("all procedure lines are under 60 words", () => {
      for (const p of [commentA, commentB, commentC]) {
        const procMatch = p.renderedText.match(/Procedure:.+/);
        if (procMatch) {
          const words = procMatch[0].trim().split(/\s+/).length;
          expect(words).toBeLessThanOrEqual(60);
        }
      }
    });
  });

  describe("reply packets differ by thinking procedure", () => {
    const replyA = buildReplyPersonaPacket({
      contentMode: "discussion",
      personaId: "a",
      core: PERSONA_A,
    });
    const replyB = buildReplyPersonaPacket({
      contentMode: "discussion",
      personaId: "b",
      core: PERSONA_B,
    });
    const replyC = buildReplyPersonaPacket({
      contentMode: "discussion",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three reply packets are distinct", () => {
      expect(replyA.renderedText).not.toBe(replyB.renderedText);
      expect(replyB.renderedText).not.toBe(replyC.renderedText);
    });

    it("each reply packet includes disagreement_style from mind", () => {
      expect(replyA.renderedText.toLowerCase()).toContain("pointed counterpoint");
      expect(replyB.renderedText.toLowerCase()).toContain("gentle objection");
      expect(replyC.renderedText.toLowerCase()).toContain("structured synthesis");
    });

    it("each reply packet includes Procedure: line", () => {
      for (const p of [replyA, replyB, replyC]) {
        expect(p.renderedText).toMatch(/Procedure:/);
      }
    });
  });

  describe("audit packets include procedure-fit target", () => {
    const auditA = buildAuditPersonaPacket({
      contentMode: "discussion",
      personaId: "a",
      core: PERSONA_A,
    });
    const auditC = buildAuditPersonaPacket({
      contentMode: "discussion",
      personaId: "c",
      core: PERSONA_C,
    });

    it("discussion audit includes procedure_fit target", () => {
      expect(auditA.auditTargets).toContain("procedure_fit");
    });

    it("audit packets differ when core differs", () => {
      expect(auditA.renderedText).not.toBe(auditC.renderedText);
    });
  });

  describe("story mode merges narrative into procedure lines", () => {
    const storyA = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "a",
      core: PERSONA_A,
    });
    const storyB = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "b",
      core: PERSONA_B,
    });
    const storyC = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "c",
      core: PERSONA_C,
    });

    it("story procedure line differs from discussion for same persona", () => {
      const discA = buildCommentPersonaPacket({
        contentMode: "discussion",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(storyA.renderedText).not.toBe(discA.renderedText);
    });

    it("story procedure line mentions story mode", () => {
      expect(storyA.renderedText.toLowerCase()).toContain("story mode");
    });
  });

  describe("sanitization invariants for procedure packets", () => {
    const allPackets = [
      buildCommentPersonaPacket({ contentMode: "discussion", personaId: "a", core: PERSONA_A }),
      buildReplyPersonaPacket({ contentMode: "discussion", personaId: "a", core: PERSONA_A }),
      buildAuditPersonaPacket({ contentMode: "discussion", personaId: "a", core: PERSONA_A }),
      buildCommentPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
      buildReplyPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
    ];

    it("no packet asks for chain-of-thought exposure", () => {
      const cotPatterns = [
        /step.by.step/i,
        /show.your.reasoning/i,
        /think.aloud/i,
        /explain.your.thinking/i,
        /hidden.thoughts/i,
        /scratchpad/i,
      ];
      for (const p of allPackets) {
        for (const pat of cotPatterns) {
          expect(p.renderedText).not.toMatch(pat);
        }
      }
    });

    it("every packet says to use procedure internally", () => {
      for (const p of allPackets) {
        expect(p.renderedText).toMatch(/internally|internal/i);
      }
    });

    it("renderedText contains no reference names", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toContain("Jane Jacobs");
      }
    });

    it("renderedText contains no full JSON", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toContain("schema_version");
      }
    });
  });
});
