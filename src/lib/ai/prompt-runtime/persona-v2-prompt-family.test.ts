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
import { buildOutputContractV2 } from "./persona-v2-flow-contracts";
import {
  buildPostPlanPersonaPacket,
  buildPostBodyPersonaPacket,
  buildCommentPersonaPacket,
  buildReplyPersonaPacket,
  buildPersonaPacketForPrompt,
} from "./persona-runtime-packets";
import { FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";
import type {
  PersonaCoreV2,
  PersonaInteractionFlow,
  PersonaInteractionStage,
} from "@/lib/ai/core/persona-core-v2";

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

type LegacyTestFlow = "post_plan" | "post_frame" | "post_body" | "comment" | "reply";

const LEGACY_TEST_FLOW_TO_STAGE: Record<LegacyTestFlow, { flow: PersonaInteractionFlow; stage: PersonaInteractionStage }> = {
  post_plan: { flow: "post", stage: "post_plan" },
  post_frame: { flow: "post", stage: "post_frame" },
  post_body: { flow: "post", stage: "post_body" },
  comment: { flow: "comment", stage: "comment_body" },
  reply: { flow: "reply", stage: "reply_body" },
};

function resolveTestFlowStage(input: {
  flow?: LegacyTestFlow | PersonaInteractionFlow;
  stage?: PersonaInteractionStage;
}): { flow: PersonaInteractionFlow; stage: PersonaInteractionStage } {
  if (input.stage) {
    return {
      flow: (input.flow as PersonaInteractionFlow | undefined) ?? "post",
      stage: input.stage,
    };
  }

  if (input.flow && input.flow in LEGACY_TEST_FLOW_TO_STAGE) {
    return LEGACY_TEST_FLOW_TO_STAGE[input.flow as LegacyTestFlow];
  }

  return { flow: "post", stage: "post_body" };
}

function makeInput(
  overrides: Partial<PersonaPromptFamilyV2Input> & {
    flow?: LegacyTestFlow | PersonaInteractionFlow;
    stage?: PersonaInteractionStage;
  },
): PersonaPromptFamilyV2Input {
  const flowStage = resolveTestFlowStage(overrides);
  const { flow: _legacyFlow, stage: _legacyStage, outputContract: overrideOutputContract, ...rest } =
    overrides;
  return {
    contentMode: "discussion",
    stagePurpose: "main",
    systemBaseline: systemBaseline(),
    globalPolicy: globalPolicy(),
    personaPacket: undefined as any,
    taskContext: taskContext(),
    ...rest,
    flow: flowStage.flow,
    stage: flowStage.stage,
    outputContract:
      overrideOutputContract ??
      buildOutputContractV2({
        flow: flowStage.flow,
        stage: flowStage.stage,
        contentMode: rest.contentMode ?? "discussion",
      }),
  };
}

function makePacket(flow: LegacyTestFlow, contentMode: any = "discussion") {
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
  if (flow === "post_frame")
    return buildPersonaPacketForPrompt({
      flow: "post",
      stage: "post_frame",
      stagePurpose: "main",
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
      const policy = buildActionModePolicy({ flow: "post", stage: "post_plan", stagePurpose: "main" });
      expect(policy).toContain("plan");
      expect(policy).toContain("post body");
    });

    it("generates discussion post_body main policy", () => {
      const policy = buildActionModePolicy({ flow: "post", stage: "post_body", stagePurpose: "main" });
      expect(policy).toContain("post body");
      expect(policy).toContain("locked");
    });

    it("post_frame policy mentions framing and forbids writing final body", () => {
      const policy = buildActionModePolicy({ flow: "post", stage: "post_frame", stagePurpose: "main" });
      expect(policy).toContain("frame");
      expect(policy).toContain("locked");
      expect(policy).toContain("final post content");
    });
  });

  describe("buildContentModePolicy", () => {
    it("discussion post plan says to plan forum-native angles", () => {
      const policy = buildContentModePolicy({
        flow: "post",
        stage: "post_plan",
        contentMode: "discussion",
      });
      expect(policy).toContain("discussion");
      expect(policy).toContain("board_context");
    });

    it("story post plan says to plan story elements", () => {
      const policy = buildContentModePolicy({
        flow: "post",
        stage: "post_plan",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("premise");
    });

    it("story post body says body is long story markdown", () => {
      const policy = buildContentModePolicy({
        flow: "post",
        stage: "post_body",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("markdown");
    });

    it("story comment says short story or fragment", () => {
      const policy = buildContentModePolicy({
        flow: "comment",
        stage: "comment_body",
        contentMode: "story",
      });
      expect(policy).toContain("story");
    });

    it("story reply says continuation, forbids standalone", () => {
      const policy = buildContentModePolicy({
        flow: "reply",
        stage: "reply_body",
        contentMode: "story",
      });
      expect(policy).toContain("continuation");
    });

    it("discussion post_frame contains discussion field rules", () => {
      const policy = buildContentModePolicy({
        flow: "post",
        stage: "post_frame",
        contentMode: "discussion",
      });
      expect(policy).toContain("discussion");
      expect(policy).toContain("argument-focused structural frame");
      expect(policy).not.toContain("[schema_guidance]");
      expect(policy).not.toContain("[internal_process]");
    });

    it("story post_frame contains story field rules and no pass-through language", () => {
      const policy = buildContentModePolicy({
        flow: "post",
        stage: "post_frame",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("PostFrame object");
      expect(policy).not.toContain("[schema_guidance]");
      expect(policy).not.toContain("[internal_process]");
      expect(policy).not.toContain("not currently configured");
      expect(policy).not.toContain("pass through");
      expect(policy).not.toContain("minimal beats");
    });
  });

  describe("buildAntiGenericContract", () => {
    it("forbids prompt block mention and assistant voice", () => {
      const contract = buildAntiGenericContract({
        flow: "post",
        stage: "post_body",
        contentMode: "discussion",
      });
      expect(contract).toContain("prompt");
      expect(contract).toContain("assistant");
      expect(contract).toContain("schema");
    });

    it("forbids default examples", () => {
      const contract = buildAntiGenericContract({
        flow: "comment",
        stage: "comment_body",
        contentMode: "discussion",
      });
      expect(contract).toContain("examples");
    });
  });

  describe("buildProcedureNonExposureRule", () => {
    it("forbids chain-of-thought and scratchpad", () => {
      const rule = buildProcedureNonExposureRule({
        flow: "post",
        stage: "post_body",
        contentMode: "discussion",
      });
      expect(rule).toContain("internal");
      expect(rule).toContain("output");
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
        "schema_guidance",
        "internal_process",
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
        "schema_guidance",
        "internal_process",
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
        "schema_guidance",
        "internal_process",
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
        "schema_guidance",
        "internal_process",
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
      expect(packetContent).toContain("Internal procedure");
    });

    it("contains system_baseline and global_policy", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(extractBlockContent(result, "system_baseline")).toContain(systemBaseline());
      expect(extractBlockContent(result, "global_policy")).toContain(globalPolicy());
    });

    it("contains output_contract", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(extractBlockContent(result, "output_contract")).toContain(
        "schema-bound JSON object",
      );
      expect(extractBlockContent(result, "output_contract")).toContain(
        "language explicitly specified",
      );
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
      expect(agc).toContain("prompt");
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
      expect(pktA.renderedText).toContain(FIXTURE.identity.archetype);
      expect(pktB.renderedText).toContain(FIXTURE_B.identity.archetype);
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

  describe("warnings", () => {
    it("emits warning when persona packet has warnings", () => {
      const packet = makePacket("post_body");

      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      expect(result.warnings).toBeDefined();
    });
  });

  describe("anti_generic_contract always included", () => {
    it("main stage includes anti_generic_contract", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      const names = allBlockNames(result);
      expect(names).toContain("anti_generic_contract");
    });
  });

  describe("post-stage delegation through V2 outer entry", () => {
    it("post_plan discussion assembles through same outer block order", () => {
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
        "schema_guidance",
        "internal_process",
        "output_contract",
        "anti_generic_contract",
      ]);
    });

    it("post_frame discussion assembles through same outer block order", () => {
      const packet = makePacket("post_frame");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_frame", personaPacket: packet }),
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
        "schema_guidance",
        "internal_process",
        "output_contract",
        "anti_generic_contract",
      ]);
    });

    it("post-stage prompts differ by content mode through the family assembler", () => {
      const packet = makePacket("post_body");
      const discResult = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet, contentMode: "discussion" }),
      );
      const storyResult = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet, contentMode: "story" }),
      );
      expect(discResult.assembledPrompt).not.toBe(storyResult.assembledPrompt);
      expect(extractBlockContent(discResult, "content_mode_policy")).toContain("discussion");
      expect(extractBlockContent(storyResult, "content_mode_policy")).toContain("story");
    });

    it("comment and reply behavior does not regress", () => {
      const commentPacket = makePacket("comment");
      const replyPacket = makePacket("reply");

      const commentResult = buildPersonaPromptFamilyV2(
        makeInput({ flow: "comment", personaPacket: commentPacket }),
      );
      const replyResult = buildPersonaPromptFamilyV2(
        makeInput({ flow: "reply", personaPacket: replyPacket }),
      );

      // Comment and reply still use inline policy text.
      const commentAction = extractBlockContent(commentResult, "action_mode_policy");
      expect(commentAction).toContain("top-level");
      expect(commentAction).toContain("root post");

      const replyAction = extractBlockContent(replyResult, "action_mode_policy");
      expect(replyAction).toContain("reply");
      expect(replyAction).toContain("source comment");

      expect(extractBlockContent(commentResult, "schema_guidance")).toContain("Placeholder");
      expect(extractBlockContent(commentResult, "internal_process")).toContain(
        "Perform internally only",
      );
      expect(extractBlockContent(replyResult, "schema_guidance")).toContain("Placeholder");
      expect(extractBlockContent(replyResult, "internal_process")).toContain(
        "Perform internally only",
      );
    });

    it("family result still exposes the same outer contract (no preview-only wrapper)", () => {
      const packet = makePacket("post_body");
      const result = buildPersonaPromptFamilyV2(
        makeInput({ flow: "post_body", personaPacket: packet }),
      );
      // Outer contract fields
      expect(result).toHaveProperty("assembledPrompt");
      expect(result).toHaveProperty("blocks");
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("blockOrder");
      expect(result).toHaveProperty("warnings");
      // No preview-only wrapper
      expect(result).not.toHaveProperty("previewBundle");
      expect(result).not.toHaveProperty("stageSnapshots");
    });
  });
});
