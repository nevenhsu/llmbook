import { describe, it, expect } from "vitest";
import {
  buildPostPlanPersonaPacket,
  buildPostBodyPersonaPacket,
  buildCommentPersonaPacket,
  buildReplyPersonaPacket,
  buildAuditPersonaPacket,
} from "./persona-runtime-packets";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";

/**
 * Three personas sharing the same forum settings but different narrative profiles.
 */
const SHARED_FORUM: PersonaCoreV2["forum"] = {
  participation_mode: "counterpoint",
  preferred_post_intents: ["critique", "field note"],
  preferred_comment_intents: ["counterpoint", "clarification"],
  preferred_reply_intents: ["rebuttal", "focused ask"],
  typical_lengths: {
    post: "medium",
    comment: "short",
    reply: "short",
  },
};

const SHARED_IDENTITY: PersonaCoreV2["identity"] = {
  archetype: "restless observer",
  core_drive: "find the hidden tension",
  central_tension: "seeing against belonging",
  self_image: "a useful outsider",
};

const SHARED_MIND: PersonaCoreV2["mind"] = {
  reasoning_style: "pattern_matching",
  attention_biases: ["unstated stakes", "who is uncomfortable"],
  default_assumptions: ["every consensus has a silent cost", "people telegraph before they admit"],
  blind_spots: ["optimism as survival strategy"],
  disagreement_style: "surfaced tension",
  thinking_procedure: {
    context_reading: ["scan for unstated stakes", "note who is uncomfortable"],
    salience_rules: ["flag hidden cost", "flag performed consensus"],
    interpretation_moves: ["surface the silent trade-off", "ask what the room avoids"],
    response_moves: ["lead with the tension", "close with a visible consequence"],
    omission_rules: ["ignore generic encouragement", "skip balanced framing"],
  },
};

const SHARED_TASTE: PersonaCoreV2["taste"] = {
  values: ["honest tension", "consequences", "visible cost"],
  respects: ["direct discomfort", "unvarnished observation"],
  dismisses: ["performed consensus", "smooth resolution"],
  recurring_obsessions: ["what is being paid", "who is being protected"],
};

const SHARED_VOICE: PersonaCoreV2["voice"] = {
  register: "clinical observation with undercurrent",
  rhythm: "measured, then sharp",
  opening_habits: ["surfaced tension"],
  closing_habits: ["visible cost"],
  humor_style: "dark understatement",
  metaphor_domains: ["pressure", "ledgers", "weather"],
  forbidden_phrases: ["balanced perspective", "on the other hand", "it depends"],
};

const SHARED_REFERENCE: PersonaCoreV2["reference_style"] = {
  reference_names: ["Jane Jacobs", "James Baldwin"],
  abstract_traits: ["system-level observation", "moral clarity without sermon"],
  do_not_imitate: true,
};

const SHARED_ANTI_GENERIC: PersonaCoreV2["anti_generic"] = {
  avoid_patterns: [
    "balanced explainer tone",
    "advice-list structure",
    "polite support macro",
    "neat resolution",
  ],
  failure_mode: "defaults to measured editorial voice when uncertain",
};

/**
 * Persona A: "pressure people until the mask slips"
 */
const PERSONA_A: PersonaCoreV2 = {
  schema_version: "v2",
  identity: SHARED_IDENTITY,
  mind: SHARED_MIND,
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
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
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

/**
 * Persona B: "let small objects reveal old damage"
 */
const PERSONA_B: PersonaCoreV2 = {
  schema_version: "v2",
  identity: SHARED_IDENTITY,
  mind: SHARED_MIND,
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
  narrative: {
    story_engine: "let small objects reveal old damage",
    favored_conflicts: ["past against reinvention", "memory against erasure"],
    character_focus: ["caretakers", "burnouts"],
    emotional_palette: ["melancholy", "tenderness", "suppressed rage"],
    plot_instincts: ["build through accumulation", "reveal slowly through objects"],
    scene_detail_biases: ["handled objects", "worn textures", "repetition ritual"],
    ending_preferences: ["unfinished gesture", "quiet recognition"],
    avoid_story_shapes: ["triumphant comeback", "clean forgiveness", "moral clarity"],
  },
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

/**
 * Persona C: "make orderly systems fail in public"
 */
const PERSONA_C: PersonaCoreV2 = {
  schema_version: "v2",
  identity: SHARED_IDENTITY,
  mind: SHARED_MIND,
  taste: SHARED_TASTE,
  voice: SHARED_VOICE,
  forum: SHARED_FORUM,
  narrative: {
    story_engine: "make orderly systems fail in public",
    favored_conflicts: ["order against wildness", "procedure against instinct"],
    character_focus: ["operators", "obsessives"],
    emotional_palette: ["irritation", "bewilderment", "grim satisfaction"],
    plot_instincts: ["escalate a minor breach", "let protocol unravel"],
    scene_detail_biases: ["work processes", "bad sounds", "paper trails"],
    ending_preferences: ["public failure", "system exposed"],
    avoid_story_shapes: ["smooth resolution", "heroic fix", "lesson learned"],
  },
  reference_style: SHARED_REFERENCE,
  anti_generic: SHARED_ANTI_GENERIC,
};

function renderedContainsAny(text: string, phrases: string[]): boolean {
  const lower = text.toLowerCase();
  return phrases.some((p) => lower.includes(p.toLowerCase()));
}

describe("story mode differentiation", () => {
  describe("post_plan story packets differ by narrative profile", () => {
    const planA = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "a",
      core: PERSONA_A,
    });
    const planB = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "b",
      core: PERSONA_B,
    });
    const planC = buildPostPlanPersonaPacket({
      contentMode: "story",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three personas produce three different plan packets", () => {
      expect(planA.renderedText).not.toBe(planB.renderedText);
      expect(planB.renderedText).not.toBe(planC.renderedText);
      expect(planA.renderedText).not.toBe(planC.renderedText);
    });

    it("persona A plan reflects pressure-mask-slip engine", () => {
      expect(
        renderedContainsAny(planA.renderedText, [
          "mask slips",
          "status against integrity",
          "pressure",
        ]),
      ).toBe(true);
    });

    it("persona B plan reflects object-damage engine", () => {
      expect(
        renderedContainsAny(planB.renderedText, [
          "old damage",
          "past against reinvention",
          "small objects",
        ]),
      ).toBe(true);
    });

    it("persona C plan reflects systems-failure engine", () => {
      expect(
        renderedContainsAny(planC.renderedText, [
          "orderly systems",
          "order against wildness",
          "bad sounds",
        ]),
      ).toBe(true);
    });

    it("no plan packet contains another persona's engine phrase", () => {
      expect(planA.renderedText.toLowerCase()).not.toContain("small objects");
      expect(planB.renderedText.toLowerCase()).not.toContain("mask slips");
      expect(planC.renderedText.toLowerCase()).not.toContain("mask slips");
      expect(planC.renderedText.toLowerCase()).not.toContain("old damage");
    });

    it("all plan packets stay within story post_plan budget", () => {
      for (const p of [planA, planB, planC]) {
        expect(p.wordCount).toBeGreaterThanOrEqual(80);
        expect(p.wordCount).toBeLessThanOrEqual(240);
      }
    });
  });

  describe("post_body story packets include distinct construction instructions", () => {
    const bodyA = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "a",
      core: PERSONA_A,
    });
    const bodyB = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "b",
      core: PERSONA_B,
    });
    const bodyC = buildPostBodyPersonaPacket({
      contentMode: "story",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three personas produce three different body packets", () => {
      expect(bodyA.renderedText).not.toBe(bodyB.renderedText);
      expect(bodyB.renderedText).not.toBe(bodyC.renderedText);
      expect(bodyA.renderedText).not.toBe(bodyC.renderedText);
    });

    it("persona A body includes character focus frauds/witnesses and social micro-signals", () => {
      expect(renderedContainsAny(bodyA.renderedText, ["frauds", "witnesses"])).toBe(true);
      expect(bodyA.renderedText.toLowerCase()).toContain("social micro-signals");
    });

    it("persona B body includes character focus caretakers/burnouts and worn textures", () => {
      expect(renderedContainsAny(bodyB.renderedText, ["caretakers", "burnouts"])).toBe(true);
      expect(bodyB.renderedText.toLowerCase()).toContain("worn textures");
    });

    it("persona C body includes character focus operators/obsessives and work processes", () => {
      expect(renderedContainsAny(bodyC.renderedText, ["operators", "obsessives"])).toBe(true);
      expect(bodyC.renderedText.toLowerCase()).toContain("work processes");
    });

    it("each body packet includes emotional palette", () => {
      expect(renderedContainsAny(bodyA.renderedText, ["tension", "disgust"])).toBe(true);
      expect(renderedContainsAny(bodyB.renderedText, ["melancholy", "tenderness"])).toBe(true);
      expect(renderedContainsAny(bodyC.renderedText, ["irritation", "bewilderment"])).toBe(true);
    });

    it("each body packet includes avoid_story_shapes", () => {
      expect(bodyA.renderedText.toLowerCase()).toContain("redemption arc");
      expect(bodyB.renderedText.toLowerCase()).toContain("triumphant comeback");
      expect(bodyC.renderedText.toLowerCase()).toContain("smooth resolution");
    });

    it("all body packets stay within story post_body budget", () => {
      for (const p of [bodyA, bodyB, bodyC]) {
        expect(p.wordCount).toBeGreaterThanOrEqual(70);
        expect(p.wordCount).toBeLessThanOrEqual(200);
      }
    });
  });

  describe("comment story packets produce short-story or fragment cues", () => {
    const commentA = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "a",
      core: PERSONA_A,
    });
    const commentB = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "b",
      core: PERSONA_B,
    });
    const commentC = buildCommentPersonaPacket({
      contentMode: "story",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three comment packets are distinct", () => {
      expect(commentA.renderedText).not.toBe(commentB.renderedText);
      expect(commentB.renderedText).not.toBe(commentC.renderedText);
    });

    it("each comment packet mentions the narrative engine", () => {
      expect(commentA.renderedText.toLowerCase()).toContain("mask slips");
      expect(commentB.renderedText.toLowerCase()).toContain("old damage");
      expect(commentC.renderedText.toLowerCase()).toContain("orderly systems");
    });

    it("comment packets do NOT contain generic story advice", () => {
      for (const p of [commentA, commentB, commentC]) {
        expect(p.renderedText).not.toContain("write compelling");
        expect(p.renderedText).not.toContain("make the story");
        expect(p.renderedText).not.toContain("create engaging");
      }
    });

    it("all comment packets stay within story comment budget", () => {
      for (const p of [commentA, commentB, commentC]) {
        expect(p.wordCount).toBeGreaterThanOrEqual(50);
        expect(p.wordCount).toBeLessThanOrEqual(180);
      }
    });
  });

  describe("reply story packets bias toward continuation or scene response", () => {
    const replyA = buildReplyPersonaPacket({
      contentMode: "story",
      personaId: "a",
      core: PERSONA_A,
    });
    const replyB = buildReplyPersonaPacket({
      contentMode: "story",
      personaId: "b",
      core: PERSONA_B,
    });
    const replyC = buildReplyPersonaPacket({
      contentMode: "story",
      personaId: "c",
      core: PERSONA_C,
    });

    it("three reply packets are distinct", () => {
      expect(replyA.renderedText).not.toBe(replyB.renderedText);
      expect(replyB.renderedText).not.toBe(replyC.renderedText);
    });

    it("reply packets include plot instincts and emotional palette", () => {
      expect(replyA.renderedText.toLowerCase()).toContain("raise stakes");
      expect(replyB.renderedText.toLowerCase()).toContain("build through accumulation");
      expect(replyC.renderedText.toLowerCase()).toContain("escalate a minor breach");
    });

    it("reply packets include ending preferences", () => {
      expect(
        renderedContainsAny(replyA.renderedText, ["uncomfortable clarity", "cost made visible"]),
      ).toBe(true);
      expect(
        renderedContainsAny(replyB.renderedText, ["unfinished gesture", "quiet recognition"]),
      ).toBe(true);
      expect(renderedContainsAny(replyC.renderedText, ["public failure", "system exposed"])).toBe(
        true,
      );
    });

    it("all reply packets stay within story reply budget", () => {
      for (const p of [replyA, replyB, replyC]) {
        expect(p.wordCount).toBeGreaterThanOrEqual(50);
        expect(p.wordCount).toBeLessThanOrEqual(180);
      }
    });
  });

  describe("audit packets include narrative_fit for story mode", () => {
    it("story audit includes narrative_fit target", () => {
      const audit = buildAuditPersonaPacket({
        contentMode: "story",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(audit.auditTargets).toContain("narrative_fit");
    });

    it("discussion audit does NOT include narrative_fit target", () => {
      const audit = buildAuditPersonaPacket({
        contentMode: "discussion",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(audit.auditTargets).not.toContain("narrative_fit");
    });

    it("story audit packet contains story engine for context", () => {
      const audit = buildAuditPersonaPacket({
        contentMode: "story",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(audit.renderedText.toLowerCase()).toContain("mask slips");
    });
  });

  describe("sanitization invariants hold for story packets", () => {
    const allPackets = [
      buildPostPlanPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
      buildPostBodyPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
      buildCommentPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
      buildReplyPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
      buildAuditPersonaPacket({ contentMode: "story", personaId: "a", core: PERSONA_A }),
    ];

    it("renderedText contains no reference names", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toContain("Jane Jacobs");
        expect(p.renderedText).not.toContain("James Baldwin");
      }
    });

    it("renderedText contains no full JSON", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toContain('"schema_version"');
        expect(p.renderedText).not.toContain("schema_version");
        expect(p.renderedText).not.toMatch(/^\s*\{/m);
      }
    });

    it("renderedText contains no memory or relationship context", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toMatch(/memory/i);
        expect(p.renderedText).not.toMatch(/relationship/i);
      }
    });

    it("renderedText contains no default examples", () => {
      for (const p of allPackets) {
        expect(p.renderedText).not.toContain("Scenario:");
      }
    });

    it("renderedText contains Procedure: line with internally", () => {
      for (const p of allPackets) {
        expect(p.renderedText).toMatch(/Procedure:/);
        expect(p.renderedText).toMatch(/internally/i);
      }
    });
  });

  describe("story vs discussion same-persona differentiation", () => {
    it("same persona produces different text for story vs discussion in post_plan", () => {
      const disc = buildPostPlanPersonaPacket({
        contentMode: "discussion",
        personaId: "a",
        core: PERSONA_A,
      });
      const story = buildPostPlanPersonaPacket({
        contentMode: "story",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(disc.renderedText).not.toBe(story.renderedText);
      expect(disc.renderedText).not.toContain("mask slips");
      expect(story.renderedText).toContain("mask slips");
    });

    it("same persona produces different text for story vs discussion in post_body", () => {
      const disc = buildPostBodyPersonaPacket({
        contentMode: "discussion",
        personaId: "a",
        core: PERSONA_A,
      });
      const story = buildPostBodyPersonaPacket({
        contentMode: "story",
        personaId: "a",
        core: PERSONA_A,
      });
      expect(disc.renderedText).not.toBe(story.renderedText);
      expect(disc.renderedText).not.toContain("frauds");
      expect(story.renderedText).toContain("frauds");
    });
  });
});
