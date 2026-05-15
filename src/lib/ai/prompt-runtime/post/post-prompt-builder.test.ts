import { describe, it, expect } from "vitest";
import {
  buildPostStageActionModePolicy,
  buildPostStageAntiGenericContract,
  buildPostStageContentModePolicy,
  buildPostStageInternalProcessBlock,
  buildPostOwnedPromptBlockContent,
  buildPostStageOutputContract,
  buildPostStageSchemaGuidanceBlock,
  buildPostStageTaskContext,
  getPostPromptBlockOrder,
  renderSelectedPostPlanTargetContext,
  renderPostFrameTargetContext,
  type CanonicalSelectedPostPlan,
  type CanonicalPostStage,
} from "./post-prompt-builder";
import type { PostFrame } from "@/lib/ai/prompt-runtime/persona-v2-flow-contracts";

function buildPlan(overrides: Partial<CanonicalSelectedPostPlan> = {}): CanonicalSelectedPostPlan {
  return {
    title: "The Missing Boundary",
    idea: "Separate generation from enforcement.",
    outline: ["Show the blame pattern", "Name the boundary", "Give the operator move"],
    ...overrides,
  };
}

function buildFrame(overrides: Partial<PostFrame> = {}): PostFrame {
  return {
    main_idea:
      "Teams over-edit prompts because they never separated generation, validation, and enforcement into distinct operating steps.",
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
    ...overrides,
  };
}

describe("buildPostStageActionModePolicy", () => {
  it("post_plan mentions planning and forbids writing final body", () => {
    const policy = buildPostStageActionModePolicy({ flow: "post", stage: "post_plan" });
    expect(policy).toContain("candidate post plans");
    expect(policy).toContain("candidate");
    expect(policy).toContain("final post body");
  });

  it("post_frame mentions frame, locked title, flat object, and forbids writing final body", () => {
    const policy = buildPostStageActionModePolicy({ flow: "post", stage: "post_frame" });
    expect(policy).toContain("frame");
    expect(policy).toContain("locked");
    expect(policy).toContain("flat object");
    expect(policy).toContain("final post body");
    expect(policy).toContain("beats");
  });

  it("post_body mentions writing final body and locked title", () => {
    const policy = buildPostStageActionModePolicy({ flow: "post", stage: "post_body" });
    expect(policy).toContain("final post body");
    expect(policy).toContain("locked title");
  });
});

describe("buildPostStageContentModePolicy", () => {
  describe("discussion mode", () => {
    it("post_plan says to plan forum-native angles", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_plan",
        contentMode: "discussion",
      });
      expect(policy).toContain("discussion");
      expect(policy).toContain("board relevance");
      expect(policy).toContain("novelty");
    });

    it("post_frame contains discussion field contracts", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_frame",
        contentMode: "discussion",
      });
      expect(policy).toContain("discussion");
      expect(policy).toContain("main_idea");
      expect(policy).toContain("required_details");
      expect(policy).toContain("[focus_contract]");
      expect(policy).toContain("[beat_contract]");
      expect(policy).toContain("[detail_contract]");
      expect(policy).toContain("[ending_contract]");
      expect(policy).toContain("[tone_contract]");
      expect(policy).toContain("[avoid_contract]");
      expect(policy).not.toContain("[schema_guidance]");
      expect(policy).not.toContain("[internal_process]");
    });

    it("post_body says write forum-native markdown, not fiction", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_body",
        contentMode: "discussion",
      });
      expect(policy).toContain("discussion");
      expect(policy).toContain("markdown");
      expect(policy).toContain("fiction");
    });
  });

  describe("story mode", () => {
    it("post_plan says to plan story elements", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_plan",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("premise");
      expect(policy).toContain("beats");
    });

    it("post_frame contains story field contracts", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_frame",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("main_idea");
      expect(policy).toContain("required_details");
      expect(policy).not.toContain("[schema_guidance]");
      expect(policy).not.toContain("[internal_process]");
      expect(policy).not.toContain("not currently configured");
      expect(policy).not.toContain("pass through");
    });

    it("post_body says write long story markdown prose", () => {
      const policy = buildPostStageContentModePolicy({
        flow: "post",
        stage: "post_body",
        contentMode: "story",
      });
      expect(policy).toContain("story");
      expect(policy).toContain("markdown");
      expect(policy).toContain("writing advice");
    });
  });
});

describe("post-frame helper blocks", () => {
  it("renders stage-specific schema_guidance across post stages", () => {
    const planBlock = buildPostStageSchemaGuidanceBlock({
      flow: "post",
      stage: "post_plan",
      contentMode: "discussion",
    });
    const frameBlock = buildPostStageSchemaGuidanceBlock({
      flow: "post",
      stage: "post_frame",
      contentMode: "discussion",
    });
    const bodyBlock = buildPostStageSchemaGuidanceBlock({
      flow: "post",
      stage: "post_body",
      contentMode: "discussion",
    });

    expect(planBlock).toContain("[schema_guidance]");
    expect(planBlock).toContain("candidates array");
    expect(frameBlock).toContain("[schema_guidance]");
    expect(frameBlock).toContain("PostFrame");
    expect(bodyBlock).toContain("[schema_guidance]");
    expect(bodyBlock).toContain("metadata.probability");
  });

  it("renders stage-specific internal_process and switches by content mode", () => {
    const planBlock = buildPostStageInternalProcessBlock({
      flow: "post",
      stage: "post_plan",
      contentMode: "discussion",
    });
    const discussionBlock = buildPostStageInternalProcessBlock({
      flow: "post",
      stage: "post_frame",
      contentMode: "discussion",
    });
    const storyBlock = buildPostStageInternalProcessBlock({
      flow: "post",
      stage: "post_frame",
      contentMode: "story",
    });
    const bodyBlock = buildPostStageInternalProcessBlock({
      flow: "post",
      stage: "post_body",
      contentMode: "discussion",
    });

    expect(planBlock).toContain("[internal_process]");
    expect(planBlock).toContain("candidate angles");
    expect(discussionBlock).toContain("[internal_process]");
    expect(discussionBlock).toContain("dominant main_idea");
    expect(storyBlock).toContain("[internal_process]");
    expect(storyBlock).toContain("dramatic main_idea");
    expect(bodyBlock).toContain("[internal_process]");
    expect(bodyBlock).toContain("selected plan/frame");
  });

  it("exposes canonical post block order and post-owned block assembly", () => {
    const order = getPostPromptBlockOrder({ flow: "post", stage: "post_frame" });
    const blocks = buildPostOwnedPromptBlockContent({
      flow: "post",
      stage: "post_frame",
      contentMode: "discussion",
      targetContext: "Locked title and idea",
      taskContext: "Write a forum post",
    });

    expect(order).toEqual([
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
    expect(blocks.target_context).toContain("Locked title");
    expect(blocks.schema_guidance).toContain("[schema_guidance]");
    expect(blocks.internal_process).toContain("[internal_process]");
  });
});

describe("buildPostStageTaskContext", () => {
  it("post_plan wraps baseTaskContext with planning-only instructions", () => {
    const ctx = buildPostStageTaskContext({
      flow: "post",
      stage: "post_plan",
      contentMode: "discussion",
    });
    expect(ctx).toContain("Write a post about AI.");
    expect(ctx).toContain("candidate post plans");
    expect(ctx).toContain("later stage");
    expect(ctx).not.toContain("final post body");
  });

  it("post_plan handles empty baseTaskContext gracefully", () => {
    const ctx = buildPostStageTaskContext({
      flow: "post",
      stage: "post_plan",
      contentMode: "discussion",
    });
    expect(ctx).toContain("candidate post plans");
    expect(ctx).not.toContain("undefined");
  });

  it("post_frame for discussion uses claim/argument field guidance", () => {
    const ctx = buildPostStageTaskContext({
      flow: "post",
      stage: "post_frame",
      contentMode: "discussion",
    });
    expect(ctx).toContain("PostFrame object");
    expect(ctx).toContain("main_idea");
    expect(ctx).toContain("ending_direction");
    expect(ctx).toContain("prompt instructions");
  });

  it("post_frame for story uses premise/narrative field guidance", () => {
    const ctx = buildPostStageTaskContext({
      flow: "post",
      stage: "post_frame",
      contentMode: "story",
    });
    expect(ctx).toContain("main_idea");
    expect(ctx).toContain("beats");
    expect(ctx).toContain("required_details");
    expect(ctx).toContain("ending_direction");
  });

  it("post_body enforces locked title and frame-guidance binding", () => {
    const ctx = buildPostStageTaskContext({
      flow: "post",
      stage: "post_body",
      contentMode: "discussion",
    });
    expect(ctx).toContain("final post body");
    expect(ctx).toContain("title");
    expect(ctx).toContain("post_frame");
    expect(ctx).toContain("markdown");
  });
});

describe("renderSelectedPostPlanTargetContext", () => {
  it("renders locked title, idea, and outline in one stable [selected_post_plan] block", () => {
    const plan = buildPlan();
    const result = renderSelectedPostPlanTargetContext(plan);
    expect(result).toContain("[selected_post_plan]");
    expect(result).toContain(plan.title);
    expect(result).toContain(plan.idea);
    expect(result).toContain("Body outline:");
    for (const item of plan.outline) {
      expect(result).toContain(item);
    }
    expect(result).toContain("title");
  });

  it("handles single-item outline", () => {
    const plan = buildPlan({ outline: ["Single beat"] });
    const result = renderSelectedPostPlanTargetContext(plan);
    expect(result).toContain("- Single beat");
  });

  it("handles longer outline", () => {
    const plan = buildPlan({ outline: ["A", "B", "C", "D", "E"] });
    const result = renderSelectedPostPlanTargetContext(plan);
    const lines = result.split("\n");
    const outlineLines = lines.filter((l) => l.startsWith("- "));
    expect(outlineLines).toHaveLength(5);
  });
});

describe("renderPostFrameTargetContext", () => {
  it("renders full [post_frame] block with mode, main_idea, angle, beats, details, ending, tone, avoid", () => {
    const frame = buildFrame();
    const result = renderPostFrameTargetContext({ frame, contentMode: "discussion" });
    expect(result).toContain("[post_frame]");
    expect(result).toContain("Content mode: discussion");
    expect(result).toContain(frame.main_idea);
    expect(result).toContain(frame.angle);
    expect(result).toContain("Beats:");
    for (const beat of frame.beats) {
      expect(result).toContain(beat);
    }
    expect(result).toContain("Required details:");
    for (const detail of frame.required_details) {
      expect(result).toContain(detail);
    }
    expect(result).toContain(frame.ending_direction);
    for (const tone of frame.tone) {
      expect(result).toContain(tone);
    }
    for (const avoid of frame.avoid) {
      expect(result).toContain(avoid);
    }
  });

  it("renders story contentMode in the block", () => {
    const frame = buildFrame();
    const result = renderPostFrameTargetContext({ frame, contentMode: "story" });
    expect(result).toContain("Content mode: story");
  });

  it("renders minimal frame correctly", () => {
    const frame = buildFrame({
      main_idea: "X",
      angle: "Y",
      beats: ["B1", "B2", "B3"],
      required_details: ["D1", "D2", "D3"],
      ending_direction: "End simply.",
      tone: ["tone1", "tone2"],
      avoid: ["avoid1", "avoid2", "avoid3"],
    });
    const result = renderPostFrameTargetContext({ frame, contentMode: "discussion" });
    expect(result).toContain("[post_frame]");
    expect(result).toContain("Main idea: X");
    expect(result).toContain("Angle: Y");
  });
});

describe("no retired labels leak into prompt text", () => {
  const allStages: CanonicalPostStage[] = ["post_plan", "post_frame", "post_body"];

  it("action mode policy never mentions retired stage labels", () => {
    for (const stage of allStages) {
      const policy = buildPostStageActionModePolicy({ flow: "post", stage });
      expect(policy).not.toContain("planner_mode");
      expect(policy).not.toContain("writer");
      expect(policy).not.toContain("agent_profile");
      expect(policy).not.toContain("agent_voice_contract");
    }
  });

  it("content mode policy never mentions retired stage labels", () => {
    for (const stage of allStages) {
      for (const mode of ["discussion", "story"] as const) {
        const policy = buildPostStageContentModePolicy({
          flow: "post",
          stage,
          contentMode: mode,
        });
        expect(policy).not.toContain("planner_mode");
        expect(policy).not.toContain("writer");
        expect(policy).not.toContain("agent_profile");
        expect(policy).not.toContain("agent_voice_contract");
      }
    }
  });

  it("task context never mentions retired stage labels", () => {
    for (const stage of allStages) {
      const ctx = buildPostStageTaskContext({
        flow: "post",
        stage,
        contentMode: "discussion",
      });
      expect(ctx).not.toContain("planner_mode");
      expect(ctx).not.toContain("writer");
      expect(ctx).not.toContain("agent_profile");
    }
  });

  it("selected plan renderer never mentions retired labels", () => {
    const plan = buildPlan();
    const result = renderSelectedPostPlanTargetContext(plan);
    expect(result).not.toContain("planner_mode");
    expect(result).not.toContain("writer");
  });

  it("post frame renderer never mentions retired labels", () => {
    const frame = buildFrame();
    const result = renderPostFrameTargetContext({ frame, contentMode: "discussion" });
    expect(result).not.toContain("planner_mode");
    expect(result).not.toContain("writer");
  });
});

describe("buildPostStageOutputContract", () => {
  it("post_plan discussion requires candidates, scores, and forbids prompt mention", () => {
    const contract = buildPostStageOutputContract({
      flow: "post",
      stage: "post_plan",
      contentMode: "discussion",
    });
    expect(contract).toContain("2 to 3 candidates");
    expect(contract).toContain("persona_fit_score");
    expect(contract).toContain("novelty_score");
    expect(contract).toContain("Do not mention prompt instructions");
    expect(contract).not.toContain("probability");
  });

  it("post_plan story mode maps to story title and premise", () => {
    const contract = buildPostStageOutputContract({
      flow: "post",
      stage: "post_plan",
      contentMode: "story",
    });
    expect(contract).toContain("story");
    expect(contract).toContain("story title");
    expect(contract).toContain("premise");
  });

  it("post_frame uses required_details and forbids markdown", () => {
    const contract = buildPostStageOutputContract({
      flow: "post",
      stage: "post_frame",
      contentMode: "discussion",
    });
    expect(contract).toContain("required_details");
    expect(contract).toContain("no extra keys");
    expect(contract).toContain("Do not use markdown");
    expect(contract).not.toContain("locked_title");
  });

  it("post_body discussion includes body, tags, and metadata.probability", () => {
    const contract = buildPostStageOutputContract({
      flow: "post",
      stage: "post_body",
      contentMode: "discussion",
    });
    expect(contract).toContain("body");
    expect(contract).toContain("tags");
    expect(contract).toContain("metadata");
    expect(contract).toContain("probability");
    expect(contract).toContain("0 to 100");
    expect(contract).not.toContain("title");
    expect(contract).toContain("final image URL");
  });

  it("post_body story mode adds story prose guidance", () => {
    const contract = buildPostStageOutputContract({
      flow: "post",
      stage: "post_body",
      contentMode: "story",
    });
    expect(contract).toContain("story markdown prose");
    expect(contract).toContain("story logic");
    expect(contract).toContain("Do not turn the story into");
  });

  it("all post stages forbid mentioning prompt instructions", () => {
    for (const stage of ["post_plan", "post_frame", "post_body"] as CanonicalPostStage[]) {
      const contract = buildPostStageOutputContract({
        flow: "post",
        stage,
        contentMode: "discussion",
      });
      expect(contract).toContain("Do not mention prompt instructions");
    }
  });
});

describe("buildPostStageAntiGenericContract", () => {
  it("forbids prompt block mention, assistant voice, and default examples", () => {
    const contract = buildPostStageAntiGenericContract({ flow: "post", stage: "post_plan" });
    expect(contract).toContain("prompt blocks");
    expect(contract).toContain("generic assistant");
    expect(contract).toContain("JSON schema");
    expect(contract).toContain("default examples");
  });

  it("produces identical text for all three post stages", () => {
    const plan = buildPostStageAntiGenericContract({ flow: "post", stage: "post_plan" });
    const frame = buildPostStageAntiGenericContract({ flow: "post", stage: "post_frame" });
    const body = buildPostStageAntiGenericContract({ flow: "post", stage: "post_body" });
    expect(frame).toBe(plan);
    expect(body).toBe(plan);
  });

  it("never mentions retired stage labels", () => {
    for (const stage of ["post_plan", "post_frame", "post_body"] as CanonicalPostStage[]) {
      const contract = buildPostStageAntiGenericContract({ flow: "post", stage });
      expect(contract).not.toContain("planner_mode");
      expect(contract).not.toContain("writer");
    }
  });
});
