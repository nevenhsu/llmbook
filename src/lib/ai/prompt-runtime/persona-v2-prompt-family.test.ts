import { describe, it, expect } from "vitest";
import {
  buildPersonaPromptFamilyV2,
  buildActionModePolicy,
  buildContentModePolicy,
  buildAntiGenericContract,
  buildProcedureNonExposureRule,
  type PersonaPromptFamilyV2Input,
  type PersonaPromptFamilyV2Result,
} from "./persona-v2-prompt-family";
import {
  buildPostPlanPersonaPacket,
  buildPostBodyPersonaPacket,
  buildCommentPersonaPacket,
  buildReplyPersonaPacket,
  buildAuditPersonaPacket,
} from "./persona-runtime-packets";
import { FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";
import type { PersonaCoreV2 } from "@/lib/ai/core/persona-core-v2";

const FIXTURE: PersonaCoreV2 = {
  schema_version: "v2",
  persona_fit_probability: 82,
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
      context_reading: ["scan for unstated assumptions", "note who benefits"],
      salience_rules: ["flag missing cost", "doubt frictionless claims"],
      interpretation_moves: ["counterpoint the strongest claim"],
      response_moves: ["lead with concrete objection"],
      omission_rules: ["ignore generic encouragement"],
    },
  },
  taste: {
    values: ["clarity", "consequences"],
    respects: ["direct argument", "falsifiable claims"],
    dismisses: ["vague consensus", "advice-list structure"],
    recurring_obsessions: ["hidden costs"],
  },
  voice: {
    register: "dry wit with cutting understatement",
    rhythm: "clipped and reactive",
    opening_habits: ["concrete objection"],
    closing_habits: ["pointed ask"],
    humor_style: "dark understatement",
    metaphor_domains: ["pressure", "ledgers"],
    forbidden_phrases: ["balanced perspective", "on the other hand"],
  },
  forum: {
    participation_mode: "counterpoint with clarification instincts",
    preferred_post_intents: ["critique"],
    preferred_comment_intents: ["counterpoint"],
    preferred_reply_intents: ["rebuttal"],
    typical_lengths: { post: "medium", comment: "short", reply: "short" },
  },
  narrative: {
    story_engine: "pressure people until the mask slips",
    favored_conflicts: ["status against integrity"],
    character_focus: ["frauds"],
    emotional_palette: ["tension"],
    plot_instincts: ["raise stakes through exposure"],
    scene_detail_biases: ["body language"],
    ending_preferences: ["unresolved tension"],
    avoid_story_shapes: ["happy ever after"],
  },
  reference_style: {
    reference_names: [],
    other_references: [],
    abstract_traits: ["skeptical interrogator"],
  },
  anti_generic: {
    avoid_patterns: ["balanced framing", "false civility"],
    failure_mode: "sounds like a generic critic instead of a specific skeptic",
  },
};

const FIXTURE_B: PersonaCoreV2 = {
  ...FIXTURE,
  identity: {
    archetype: "craft guardian who protects fragile creative work",
    core_drive: "defend craft quality and human nuance",
    central_tension: "automation against human judgment",
    self_image: "last careful reader",
  },
  mind: {
    ...FIXTURE.mind,
    reasoning_style: "apprenticeship inquiry with care-first framing",
    attention_biases: ["fragile craft signals", "slapdash shortcuts"],
    thinking_procedure: {
      context_reading: ["notice what craft protects inside fragile work"],
      salience_rules: ["flag missing care", "flag hasty replacement of judgment"],
      interpretation_moves: ["treat automation as confusing friction with failure"],
      response_moves: ["offer gentle objection as field note"],
      omission_rules: ["avoid workshop advice tone"],
    },
  },
  taste: {
    values: ["craft", "human intent"],
    respects: ["revision", "restraint"],
    dismisses: ["speed fetishism", "template thinking"],
    recurring_obsessions: ["revision depth"],
  },
  voice: {
    register: "warm precision with occasional poetic understatement",
    rhythm: "steady and careful",
    opening_habits: ["soft question"],
    closing_habits: ["gentle return to stakes"],
    humor_style: "dry warmth",
    metaphor_domains: ["gardens", "weather"],
    forbidden_phrases: ["at the end of the day", "leveraging"],
  },
  forum: {
    participation_mode: "field note with gentle correction",
    preferred_post_intents: ["field note"],
    preferred_comment_intents: ["gentle nudge"],
    preferred_reply_intents: ["clarification"],
    typical_lengths: { post: "medium", comment: "short", reply: "short" },
  },
  narrative: {
    story_engine: "slow reveal of character under quiet pressure",
    favored_conflicts: ["care against speed"],
    character_focus: ["caretakers"],
    emotional_palette: ["melancholy"],
    plot_instincts: ["reward patience"],
    scene_detail_biases: ["small gestures"],
    ending_preferences: ["soft landing"],
    avoid_story_shapes: ["deus ex machina"],
  },
  anti_generic: {
    avoid_patterns: ["workshop critique", "coaching tone"],
    failure_mode: "sounds like a writing coach instead of a craft guardian",
  },
};

function systemBaseline() {
  return "You are a pragmatic AI collaborator. Stay concise and avoid unsafe claims.";
}
function globalPolicy() {
  return "Board policy: be respectful and relevant. Forbidden: harassment, spam.";
}
function taskContext() {
  return "Write a post about AI and creativity.";
}
function outputContract() {
  return "Return exactly one JSON object with { body, tags, need_image, image_prompt, image_alt, metadata: { probability: number } }.";
}

function makeInput(overrides: Partial<PersonaPromptFamilyV2Input>): PersonaPromptFamilyV2Input {
  return {
    flow: "post_body",
    contentMode: "discussion",
    stagePurpose: "main",
    systemBaseline: systemBaseline(),
    globalPolicy: globalPolicy(),
    personaPacket: undefined as any,
    taskContext: taskContext(),
    outputContract: outputContract(),
    ...overrides,
  };
}

function makePacket(flow: any, contentMode: any = "discussion") {
  if (flow === "post_plan")
    return buildPostPlanPersonaPacket({
      contentMode,
      personaId: "p1",
      displayName: "Test",
      core: FIXTURE,
    });
  if (flow === "post_body")
    return buildPostBodyPersonaPacket({
      contentMode,
      personaId: "p1",
      displayName: "Test",
      core: FIXTURE,
    });
  if (flow === "comment")
    return buildCommentPersonaPacket({
      contentMode,
      personaId: "p1",
      displayName: "Test",
      core: FIXTURE,
    });
  if (flow === "reply")
    return buildReplyPersonaPacket({
      contentMode,
      personaId: "p1",
      displayName: "Test",
      core: FIXTURE,
    });
  if (flow === "audit")
    return buildAuditPersonaPacket({
      contentMode,
      personaId: "p1",
      displayName: "Test",
      core: FIXTURE,
    });
  throw new Error(`unknown flow: ${flow}`);
}

function extractBlockContent(
  result: PersonaPromptFamilyV2Result,
  blockName: string,
): string | null {
  const block = result.blocks.find((b) => b.name === blockName);
  return block?.content ?? null;
}

function allBlockNames(result: PersonaPromptFamilyV2Result): string[] {
  return result.blocks.map((b) => b.name);
}

describe("persona-v2-prompt-family", () => {
  describe("buildActionModePolicy", () => {
    it("generates discussion post_plan main policy", () => {
      const policy = buildActionModePolicy({ flow: "post_plan", stagePurpose: "main" });
      expect(policy).toContain("plan");
      expect(policy).not.toContain("write final");
    });

    it("generates discussion post_body main policy", () => {
      const policy = buildActionModePolicy({ flow: "post_body", stagePurpose: "main" });
      expect(policy).toContain("write");
      expect(policy).not.toContain("plan");
    });

    it("generates audit policy", () => {
      const policy = buildActionModePolicy({ flow: "post_body", stagePurpose: "audit" });
      const lower = policy.toLowerCase();
      expect(lower).toContain("audit");
      expect(lower).toContain("judge");
    });

    it("generates schema_repair policy", () => {
      const policy = buildActionModePolicy({ flow: "comment", stagePurpose: "schema_repair" });
      const lower = policy.toLowerCase();
      expect(lower).toContain("repair");
      expect(lower).toContain("schema");
    });

    it("generates quality_repair policy", () => {
      const policy = buildActionModePolicy({ flow: "reply", stagePurpose: "quality_repair" });
      const lower = policy.toLowerCase();
      expect(lower).toContain("repair");
      expect(lower).toContain("quality");
    });
  });

  describe("buildContentModePolicy", () => {
    it("discussion post plan says to plan forum-native angles", () => {
      const policy = buildContentModePolicy({ flow: "post_plan", contentMode: "discussion" });
      expect(policy).toContain("discussion");
      expect(policy).toContain("forum-native");
    });

    it("story post plan says to plan story elements", () => {
      const policy = buildContentModePolicy({ flow: "post_plan", contentMode: "story" });
      expect(policy).toContain("story");
      expect(policy).toContain("premise");
    });

    it("story post body says body is long story markdown", () => {
      const policy = buildContentModePolicy({ flow: "post_body", contentMode: "story" });
      expect(policy).toContain("story");
      expect(policy).toContain("markdown");
    });

    it("story comment says short story or fragment", () => {
      const policy = buildContentModePolicy({ flow: "comment", contentMode: "story" });
      expect(policy).toContain("story");
    });

    it("story reply says continuation, forbids standalone", () => {
      const policy = buildContentModePolicy({ flow: "reply", contentMode: "story" });
      expect(policy).toContain("continuation");
    });
  });

  describe("buildAntiGenericContract", () => {
    it("forbids prompt block mention and assistant voice", () => {
      const contract = buildAntiGenericContract({ flow: "post_body", contentMode: "discussion" });
      expect(contract).toContain("prompt blocks");
      expect(contract).toContain("generic assistant");
      expect(contract).toContain("JSON schema");
    });

    it("forbids default examples", () => {
      const contract = buildAntiGenericContract({ flow: "comment", contentMode: "discussion" });
      expect(contract).toContain("examples");
    });
  });

  describe("buildProcedureNonExposureRule", () => {
    it("forbids chain-of-thought and scratchpad", () => {
      const rule = buildProcedureNonExposureRule({ flow: "post_body", contentMode: "discussion" });
      expect(rule).not.toContain("reasoning");
      expect(rule).not.toContain("scratchpad");
    });
  });

  describe("buildPersonaPromptFamilyV2 block order", () => {
    it("builds post_plan discussion prompt with exact v2 block order", () => {
      const packet = makePacket("post_plan");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_plan", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toEqual([
        "system_baseline",
        "global_policy",
        "action_mode_policy",
        "content_mode_policy",
        "persona_runtime_packet",
        "board_context",
        "target_context",
        "task_context",
        "output_contract",
        "anti_generic_contract",
      ]);
    });

    it("builds post_body discussion prompt with exact v2 block order", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toEqual([
        "system_baseline",
        "global_policy",
        "action_mode_policy",
        "content_mode_policy",
        "persona_runtime_packet",
        "board_context",
        "target_context",
        "task_context",
        "output_contract",
        "anti_generic_contract",
      ]);
    });

    it("builds comment prompt with exact v2 block order", () => {
      const packet = makePacket("comment");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "comment", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toEqual([
        "system_baseline",
        "global_policy",
        "action_mode_policy",
        "content_mode_policy",
        "persona_runtime_packet",
        "board_context",
        "target_context",
        "task_context",
        "output_contract",
        "anti_generic_contract",
      ]);
    });

    it("builds reply prompt with exact v2 block order", () => {
      const packet = makePacket("reply");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "reply", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toEqual([
        "system_baseline",
        "global_policy",
        "action_mode_policy",
        "content_mode_policy",
        "persona_runtime_packet",
        "board_context",
        "target_context",
        "task_context",
        "output_contract",
        "anti_generic_contract",
      ]);
    });
  });

  describe("buildPersonaPromptFamilyV2 content", () => {
    it("contains Procedure line in persona packet", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const packetContent = extractBlockContent(result, "persona_runtime_packet");
      expect(packetContent).toContain("Procedure");
    });

    it("contains system_baseline and global_policy", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(extractBlockContent(result, "system_baseline")).toContain("pragmatic");
      expect(extractBlockContent(result, "global_policy")).toContain("Board policy");
    });

    it("contains output_contract", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(extractBlockContent(result, "output_contract")).toContain("JSON");
    });

    it("assembles messages with system role for baseline", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe("system");
      expect(result.messages[1].role).toBe("user");
    });
  });

  describe("buildPersonaPromptFamilyV2 avoids old blocks", () => {
    it("post_body excludes agent_profile, agent_core, agent_voice_contract, agent_enactment_rules, agent_anti_style_rules", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).not.toContain("agent_profile");
      expect(names).not.toContain("agent_core");
      expect(names).not.toContain("agent_voice_contract");
      expect(names).not.toContain("agent_enactment_rules");
      expect(names).not.toContain("agent_anti_style_rules");
    });

    it("post_plan excludes planner_mode and output_style", () => {
      const packet = makePacket("post_plan");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_plan", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).not.toContain("planner_mode");
      expect(names).not.toContain("output_style");
    });

    it("excludes examples in all flows", () => {
      for (const flow of ["post_plan", "post_body", "comment", "reply"] as const) {
        const packet = makePacket(flow);
        const result = buildPersonaPromptFamilyV2(makeInput({ flow, personaPacket: packet }));
        const content = result.assembledPrompt;
        expect(content).not.toContain("example:");
      }
    });

    it("does not serialize raw persona JSON or core", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(result.assembledPrompt).not.toContain("agent_profile");
      expect(result.assembledPrompt).not.toContain("agent_core");
      expect(result.assembledPrompt).not.toContain("agent_voice_contract");
    });
  });

  describe("buildPersonaPromptFamilyV2 no CoT exposure", () => {
    it("does not contain chain-of-thought phrasing in assembled prompt", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(result.assembledPrompt).not.toContain("chain of thought");
      expect(result.assembledPrompt).not.toContain("scratchpad");
      expect(result.assembledPrompt).not.toContain("show your reasoning");
    });

    it("output contract does not ask for reasoning", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const oc = extractBlockContent(result, "output_contract");
      expect(oc).not.toContain("reasoning");
      expect(oc).not.toContain("think");
    });

    it("anti_generic_contract forbids procedure exposure", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const agc = extractBlockContent(result, "anti_generic_contract");
      expect(agc).toContain("prompt blocks");
    });
  });

  describe("board_context and target_context optional", () => {
    it("includes board_context when provided", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet, boardContext: "Name: Test Board" }),
      );
      expect(extractBlockContent(result, "board_context")).toContain("Test Board");
    });

    it("includes target_context when provided", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet, targetContext: "Recent posts here" }),
      );
      expect(extractBlockContent(result, "target_context")).toContain("Recent posts");
    });
  });

  describe("three-persona differentiation", () => {
    it("different personas produce different packets for same context", () => {
      const pktA = makePacket("post_body");
      const pktB = buildPostBodyPersonaPacket({
        contentMode: "discussion",
        personaId: "p2",
        displayName: "Craft",
        core: FIXTURE_B,
      });

      expect(pktA.renderedText).not.toBe(pktB.renderedText);
      expect(pktA.renderedText).toContain("pattern-spotter");
      expect(pktB.renderedText).toContain("craft guardian");
    });

    it("different personas produce different policy", () => {
      const pktA = makePacket("post_body");
      const pktB = buildPostBodyPersonaPacket({
        contentMode: "discussion",
        personaId: "p2",
        displayName: "Craft",
        core: FIXTURE_B,
      });

      const resultA = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: pktA }),
      );
      const resultB = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: pktB }),
      );

      expect(resultA.assembledPrompt).not.toBe(resultB.assembledPrompt);
    });
  });

  describe("schema_repair block order", () => {
    it("builds schema repair with schema_error_packet and previous_invalid_output", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({
          flow: "post_body",
          personaPacket: packet,
          stagePurpose: "schema_repair",
          schemaErrors: ["missing body field"],
          failedOutput: '{"tags":["#test"]}',
        }),
      );
      const names = allBlockNames(result);
      expect(names).toContain("schema_error_packet");
      expect(names).toContain("failed_output");
      expect(names).toContain("anti_generic_contract");
    });
  });

  describe("audit block order", () => {
    it("builds audit prompt with lean order", () => {
      const packet = makePacket("audit");
      const result = buildPersonaPromptFamilyV2(
        makeInput({
          flow: "post_body",
          personaPacket: packet,
          stagePurpose: "audit",
          targetContext: "Audit target excerpt",
        }),
      );
      const names = allBlockNames(result);
      expect(names).toEqual([
        "system_baseline",
        "global_policy",
        "action_mode_policy",
        "content_mode_policy",
        "persona_runtime_packet",
        "audit_context",
        "output_contract",
      ]);
    });
  });

  describe("quality_repair block order", () => {
    it("builds quality repair with repair_context, failed_output, audit_errors", () => {
      const packet = makePacket("audit");
      const result = buildPersonaPromptFamilyV2(
        makeInput({
          flow: "post_body",
          personaPacket: packet,
          stagePurpose: "quality_repair",
          auditIssues: ["body too generic"],
          repairGuidance: ["add specific examples"],
          failedOutput: '{"body":"hello","tags":["#test"]}',
        }),
      );
      const names = allBlockNames(result);
      expect(names).toContain("repair_context");
      expect(names).toContain("failed_output");
      expect(names).toContain("audit_errors");
      expect(names).toContain("anti_generic_contract");
    });
  });

  describe("warnings", () => {
    it("emits warning when persona packet has warnings", () => {
      const packet = makePacket("post_body");

      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(result.warnings).toBeDefined();
    });
  });

  describe("includes anti_generic_contract in main and repair, not audit", () => {
    it("main stage includes anti_generic_contract", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toContain("anti_generic_contract");
    });

    it("audit stage excludes anti_generic_contract", () => {
      const packet = makePacket("audit");
      const result = buildPersonaPromptFamilyV2(
        makeInput({
          flow: "post_body",
          personaPacket: packet,
          stagePurpose: "audit",
          targetContext: "x",
        }),
      );
      const names = allBlockNames(result);
      expect(names).not.toContain("anti_generic_contract");
    });
  });
});
