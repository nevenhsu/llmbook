import { describe, it, expect } from "vitest";
import {
  buildOutputContractV2,
  buildAuditOutputContractV2,
  parseMetadataProbability,
  normalizeMetadataProbability,
  PostPlanOutputSchema,
  PostFrameSchema,
  PostBodyOutputSchema,
  CommentOutputSchema,
  ReplyOutputSchema,
  PostPlanDiscussionAuditSchema,
  PostPlanStoryAuditSchema,
  PostBodyDiscussionAuditSchema,
  PostBodyStoryAuditSchema,
  CommentDiscussionAuditSchema,
  CommentStoryAuditSchema,
  ReplyDiscussionAuditSchema,
  ReplyStoryAuditSchema,
  POST_PLAN_SCHEMA_META,
  POST_FRAME_SCHEMA_META,
  POST_BODY_SCHEMA_META,
  COMMENT_SCHEMA_META,
  REPLY_SCHEMA_META,
  getFlowSchemaMeta,
  type SchemaMetadata,
} from "./persona-v2-flow-contracts";

describe("persona-v2-flow-contracts", () => {
  describe("buildOutputContractV2", () => {
    it("includes metadata.probability for post_body", () => {
      const contract = buildOutputContractV2({ flow: "post_body", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
      expect(contract).toContain("0 to 100");
    });

    it("includes metadata.probability for post", () => {
      const contract = buildOutputContractV2({ flow: "post", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("includes metadata.probability for comment", () => {
      const contract = buildOutputContractV2({ flow: "comment", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("includes metadata.probability for reply", () => {
      const contract = buildOutputContractV2({ flow: "reply", contentMode: "discussion" });
      expect(contract).toContain("metadata");
      expect(contract).toContain("probability");
    });

    it("post_plan does NOT include metadata.probability", () => {
      const contract = buildOutputContractV2({ flow: "post_plan", contentMode: "discussion" });
      expect(contract).not.toContain("probability");
      expect(contract).toContain("candidates"); // post_plan uses candidate schema
    });

    it("post_plan story mode maps to story title and thesis", () => {
      const contract = buildOutputContractV2({ flow: "post_plan", contentMode: "story" });
      expect(contract).toContain("story");
      expect(contract).toContain("candidates");
      // Uses same candidate schema, story semantics from content_mode_policy
    });

    it("post_body story mode keeps same JSON keys", () => {
      const contract = buildOutputContractV2({ flow: "post_body", contentMode: "story" });
      expect(contract).toContain("body");
      expect(contract).toContain("tags");
      expect(contract).not.toContain("title");
      expect(contract).toContain("metadata");
    });

    it("comment story mode keeps same markdown-plus-metadata contract", () => {
      const contract = buildOutputContractV2({ flow: "comment", contentMode: "story" });
      expect(contract).toContain("markdown");
      expect(contract).toContain("metadata");
      expect(contract).not.toContain("title");
    });

    it("reply story mode keeps same markdown-plus-metadata contract", () => {
      const contract = buildOutputContractV2({ flow: "reply", contentMode: "story" });
      expect(contract).toContain("markdown");
      expect(contract).toContain("metadata");
    });

    it("all writer contracts include JSON-only instruction", () => {
      for (const flow of ["post_body", "post", "comment", "reply"] as const) {
        const contract = buildOutputContractV2({ flow, contentMode: "discussion" });
        expect(contract).toContain("JSON");
      }
    });
  });

  describe("buildAuditOutputContractV2", () => {
    it("does not score, validate, or explain probability", () => {
      for (const flow of ["post_body", "comment", "reply"] as const) {
        const contract = buildAuditOutputContractV2({ flow, contentMode: "discussion" });
        expect(contract).not.toContain("probability");
      }
    });

    it("includes audit-specific keys", () => {
      const contract = buildAuditOutputContractV2({ flow: "post_body", contentMode: "discussion" });
      expect(contract).toContain("passes");
      expect(contract).toContain("issues");
    });
  });

  describe("parseMetadataProbability", () => {
    it("returns valid integer as-is", () => {
      expect(parseMetadataProbability(85)).toBe(85);
      expect(parseMetadataProbability(0)).toBe(0);
      expect(parseMetadataProbability(100)).toBe(100);
      expect(parseMetadataProbability(50)).toBe(50);
    });

    it("defaults missing to 0", () => {
      expect(parseMetadataProbability(undefined)).toBe(0);
      expect(parseMetadataProbability(null)).toBe(0);
    });

    it("defaults non-integer to 0", () => {
      expect(parseMetadataProbability(85.5)).toBe(0);
      expect(parseMetadataProbability("85")).toBe(0);
      expect(parseMetadataProbability(true)).toBe(0);
      expect(parseMetadataProbability([])).toBe(0);
      expect(parseMetadataProbability({})).toBe(0);
    });

    it("defaults out-of-range to 0", () => {
      expect(parseMetadataProbability(-1)).toBe(0);
      expect(parseMetadataProbability(101)).toBe(0);
      expect(parseMetadataProbability(1000)).toBe(0);
      expect(parseMetadataProbability(-100)).toBe(0);
    });

    it("handles edge cases", () => {
      expect(parseMetadataProbability(NaN)).toBe(0);
      expect(parseMetadataProbability(Infinity)).toBe(0);
      expect(parseMetadataProbability(-Infinity)).toBe(0);
    });
  });

  describe("normalizeMetadataProbability", () => {
    it("extracts probability from metadata record", () => {
      expect(normalizeMetadataProbability({ probability: 75 })).toEqual({ probability: 75 });
    });

    it("defaults missing metadata to 0", () => {
      expect(normalizeMetadataProbability(undefined)).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability(null)).toEqual({ probability: 0 });
    });

    it("defaults non-object metadata to 0", () => {
      expect(normalizeMetadataProbability("nope")).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability(42)).toEqual({ probability: 0 });
    });

    it("defaults missing probability field to 0", () => {
      expect(normalizeMetadataProbability({ other: 1 })).toEqual({ probability: 0 });
    });

    it("clamps and validates through parseMetadataProbability", () => {
      expect(normalizeMetadataProbability({ probability: -5 })).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability({ probability: 101 })).toEqual({ probability: 0 });
      expect(normalizeMetadataProbability({ probability: 88.5 })).toEqual({ probability: 0 });
    });
  });
});

describe("Zod output schemas", () => {
  describe("PostPlanOutputSchema", () => {
    it("validates valid post plan output", () => {
      const result = PostPlanOutputSchema.safeParse({
        candidates: [
          {
            title: "A",
            thesis: "B",
            body_outline: ["1", "2"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
          {
            title: "C",
            thesis: "D",
            body_outline: ["3", "4"],
            persona_fit_score: 75,
            novelty_score: 65,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects fewer than 2 candidates", () => {
      const result = PostPlanOutputSchema.safeParse({
        candidates: [
          {
            title: "A",
            thesis: "B",
            body_outline: ["1"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 3 candidates", () => {
      const result = PostPlanOutputSchema.safeParse({
        candidates: [
          {
            title: "1",
            thesis: "2",
            body_outline: ["3"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
          {
            title: "4",
            thesis: "5",
            body_outline: ["6"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
          {
            title: "7",
            thesis: "8",
            body_outline: ["9"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
          {
            title: "10",
            thesis: "11",
            body_outline: ["12"],
            persona_fit_score: 80,
            novelty_score: 70,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("strips extra keys", () => {
      const result = PostPlanOutputSchema.safeParse({
        candidates: [
          {
            title: "A",
            thesis: "B",
            body_outline: ["1", "2"],
            persona_fit_score: 80,
            novelty_score: 70,
            extra: "bad",
          },
          {
            title: "C",
            thesis: "D",
            body_outline: ["3", "4"],
            persona_fit_score: 75,
            novelty_score: 65,
          },
        ],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.candidates[0] as Record<string, unknown>).extra).toBeUndefined();
      }
    });
  });

  describe("PostBodyOutputSchema", () => {
    it("validates valid post body output", () => {
      const result = PostBodyOutputSchema.safeParse({
        body: "Hello world",
        tags: ["#hello"],
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: { probability: 50 },
      });
      expect(result.success).toBe(true);
    });

    it("metadata.probability defaults to 0 when missing from metadata object", () => {
      const result = PostBodyOutputSchema.safeParse({
        body: "Hello",
        tags: ["#hi"],
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: {},
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.metadata.probability).toBe(0);
      }
    });

    it("allows nullable image fields", () => {
      const result = PostBodyOutputSchema.safeParse({
        body: "Hello",
        tags: ["#hi"],
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: { probability: 0 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("CommentOutputSchema", () => {
    it("validates valid comment output", () => {
      const result = CommentOutputSchema.safeParse({
        markdown: "A comment",
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: { probability: 80 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ReplyOutputSchema", () => {
    it("validates valid reply output", () => {
      const result = ReplyOutputSchema.safeParse({
        markdown: "A reply",
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: { probability: 75 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("PostFrameSchema", () => {
    it("validates a valid compact post frame", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "The Missing Boundary",
        main_idea:
          "Teams over-edit prompts because they never separate generation, validation, and enforcement.",
        angle: "The workflow boundary is the real bottleneck, not the prompt wording.",
        beats: [
          "Hook: show why prompt tuning gets blamed too early",
          "Example: contrast malformed-output repair with policy enforcement",
          "Interpretation: explain what the boundary shift reveals about tool design",
          "Twist: the best prompt engineers stop tuning and start enforcing",
          "Closing: reframe the operator's job as boundary maintenance",
        ],
        required_details: [
          "A concrete example of a malformed JSON output that passed validation",
          "The specific moment when enforcement, not repair, caught the issue",
          "A social observation about why teams prefer prompt tuning to workflow changes",
          "A comparison to a non-AI engineering discipline (e.g. compiler passes)",
        ],
        ending_direction:
          "Land on the irony that the fix was never about better prompts — it was about harder gates.",
        tone: ["sharp", "practical", "slightly contrarian"],
        avoid: [
          "vague commentary without example",
          "generic summary without specific observation",
          "tutorial tone",
          "assistant-like explanation",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("validates story mode post frame", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "story",
        locked_title: "The Last Warm Pool",
        main_idea:
          "An old-blood Deep One must decide whether to share the last volcanic pool with surface-born hybrids as the ocean cools.",
        angle:
          "Told through the ritual of pool-allocation, where every gesture carries centuries of hierarchy.",
        beats: [
          "Setup: the cooling announcement and the old-blood's morning ritual",
          "Encounter: a young hybrid petitions for access outside the cycle",
          "Complication: the old-blood's own child supports the petition",
          "Recognition: the hierarchy was never about warmth — it was about being seen as ancient",
          "Ending: the old-blood opens the gate but cannot enter the pool",
        ],
        required_details: [
          "The phosphorescent lichen that marks the pool's edge",
          "The sound of gill-flutters in silence as the petition is read",
          "A dialogue fragment: 'You were surface-born. You don't know what cold means.'",
          "The social rule that elders enter first, regardless of need",
          "The gesture of touching one's own gill-slits before speaking to an elder",
        ],
        ending_direction:
          "Image: the old-blood watches from the cold trench as hybrids share the pool, feeling the warmth through the water but not entering.",
        tone: ["eerie", "restrained", "melancholy", "ceremonial"],
        avoid: [
          "direct moralizing about equality",
          "plot summary instead of scene",
          "generic horror adjectives like 'eldritch' or 'unimaginable'",
          "assistant-like commentary",
          "abstract claims without sensory dramatization",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects old nested beat objects", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test idea",
        angle: "Test angle",
        beats: [
          { purpose: "Hook", must_include: ["detail 1", "detail 2"] },
          { purpose: "Body", must_include: ["detail 3"] },
          { purpose: "Closing", must_include: ["detail 4", "detail 5"] },
        ],
        required_details: ["detail a", "detail b", "detail c"],
        ending_direction: "Test ending",
        tone: ["sharp", "practical"],
        avoid: ["vague", "generic", "tutorial"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects old nested details object", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test idea",
        angle: "Test angle",
        beats: ["beat 1", "beat 2", "beat 3"],
        details: {
          examples: ["ex1", "ex2"],
          sensory_or_scene: ["s1"],
          social_or_behavioral: ["sb1"],
          contrast: "contrast text",
        },
        ending_direction: "Test ending",
        tone: ["sharp", "practical"],
        avoid: ["vague", "generic", "tutorial"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects fewer than 3 beats", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["beat 1", "beat 2"],
        required_details: ["d1", "d2", "d3"],
        ending_direction: "Test",
        tone: ["sharp", "practical"],
        avoid: ["a", "b", "c"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects more than 5 beats", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["b1", "b2", "b3", "b4", "b5", "b6"],
        required_details: ["d1", "d2", "d3"],
        ending_direction: "Test",
        tone: ["sharp", "practical"],
        avoid: ["a", "b", "c"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects fewer than 3 required_details", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["b1", "b2", "b3"],
        required_details: ["d1", "d2"],
        ending_direction: "Test",
        tone: ["sharp", "practical"],
        avoid: ["a", "b", "c"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects fewer than 2 tone items", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["b1", "b2", "b3"],
        required_details: ["d1", "d2", "d3"],
        ending_direction: "Test",
        tone: ["only one"],
        avoid: ["a", "b", "c"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects fewer than 3 avoid items", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "discussion",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["b1", "b2", "b3"],
        required_details: ["d1", "d2", "d3"],
        ending_direction: "Test",
        tone: ["sharp", "practical"],
        avoid: ["only", "two"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid content_mode", () => {
      const result = PostFrameSchema.safeParse({
        content_mode: "essay",
        locked_title: "Test",
        main_idea: "Test",
        angle: "Test",
        beats: ["b1", "b2", "b3"],
        required_details: ["d1", "d2", "d3"],
        ending_direction: "Test",
        tone: ["sharp", "practical"],
        avoid: ["a", "b", "c"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("audit schemas", () => {
    it("PostPlanDiscussionAuditSchema has exactly two checks", () => {
      const result = PostPlanDiscussionAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { candidate_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("PostPlanStoryAuditSchema has exactly two checks", () => {
      const result = PostPlanStoryAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { story_candidate_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("PostBodyDiscussionAuditSchema validates", () => {
      const result = PostBodyDiscussionAuditSchema.safeParse({
        passes: false,
        issues: ["issue"],
        repairGuidance: ["guidance"],
        checks: { content_quality: "fail", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("PostBodyStoryAuditSchema validates", () => {
      const result = PostBodyStoryAuditSchema.safeParse({
        passes: false,
        issues: ["issue"],
        repairGuidance: ["guidance"],
        checks: { story_quality: "fail", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("CommentDiscussionAuditSchema validates", () => {
      const result = CommentDiscussionAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { comment_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("CommentStoryAuditSchema validates", () => {
      const result = CommentStoryAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { story_comment_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("ReplyDiscussionAuditSchema validates", () => {
      const result = ReplyDiscussionAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { reply_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("ReplyStoryAuditSchema validates", () => {
      const result = ReplyStoryAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { story_reply_quality: "pass", persona_fit: "pass" },
      });
      expect(result.success).toBe(true);
    });

    it("audit schemas strip extra checks keys", () => {
      const result = PostPlanDiscussionAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { candidate_quality: "pass", persona_fit: "pass", extra_check: "pass" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.checks as Record<string, unknown>).extra_check).toBeUndefined();
      }
    });

    it("audit schemas reject unknown pass/fail values", () => {
      const result = PostPlanDiscussionAuditSchema.safeParse({
        passes: true,
        issues: [],
        repairGuidance: [],
        checks: { candidate_quality: "unknown", persona_fit: "pass" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("schema metadata", () => {
    it("POST_PLAN_SCHEMA_META has required fields", () => {
      expect(POST_PLAN_SCHEMA_META.schemaName).toBe("PostPlanOutputSchema");
      expect(POST_PLAN_SCHEMA_META.validationRules.length).toBeGreaterThan(0);
      expect(POST_PLAN_SCHEMA_META.allowedRepairPaths.length).toBeGreaterThan(0);
      expect(POST_PLAN_SCHEMA_META.immutablePaths.length).toBeGreaterThan(0);
    });

    it("POST_BODY_SCHEMA_META has required fields", () => {
      expect(POST_BODY_SCHEMA_META.schemaName).toBe("PostBodyOutputSchema");
      expect(POST_BODY_SCHEMA_META.allowedRepairPaths).toContain("metadata.probability");
    });

    it("POST_FRAME_SCHEMA_META has required fields", () => {
      expect(POST_FRAME_SCHEMA_META.schemaName).toBe("PostFrameSchema");
      expect(POST_FRAME_SCHEMA_META.validationRules.length).toBeGreaterThan(0);
      expect(POST_FRAME_SCHEMA_META.allowedRepairPaths.length).toBeGreaterThan(0);
      expect(POST_FRAME_SCHEMA_META.immutablePaths).toContain("locked_title");
      expect(POST_FRAME_SCHEMA_META.allowedRepairPaths).not.toContain("beats.*.purpose");
      expect(POST_FRAME_SCHEMA_META.allowedRepairPaths).not.toContain("details");
    });

    it("getFlowSchemaMeta returns correct metadata", () => {
      expect(getFlowSchemaMeta("post_plan").schemaName).toBe("PostPlanOutputSchema");
      expect(getFlowSchemaMeta("post_frame").schemaName).toBe("PostFrameSchema");
      expect(getFlowSchemaMeta("post_body").schemaName).toBe("PostBodyOutputSchema");
      expect(getFlowSchemaMeta("comment").schemaName).toBe("CommentOutputSchema");
      expect(getFlowSchemaMeta("reply").schemaName).toBe("ReplyOutputSchema");
    });

    it("getFlowSchemaMeta throws for unknown flow", () => {
      expect(() => getFlowSchemaMeta("unknown")).toThrow();
    });
  });
});
