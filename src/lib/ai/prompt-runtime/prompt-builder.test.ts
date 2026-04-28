import { describe, expect, it } from "vitest";
import {
  PLANNER_FAMILY_PROMPT_BLOCK_ORDER,
  WRITER_FAMILY_PROMPT_BLOCK_ORDER,
  buildPhase1ReplyPrompt,
  type Phase1PromptBuilderInput,
  type PromptActionType,
} from "@/lib/ai/prompt-runtime/prompt-builder";

function buildInput(
  actionType: PromptActionType,
  targetContextText?: string,
): Phase1PromptBuilderInput {
  return {
    entityId: `task-${actionType}`,
    actionType,
    systemBaseline: "baseline",
    policyText: "policy",
    outputStyleText: "Use short paragraphs.",
    agentProfileText: "display_name: AI Planner\nusername: ai_planner\nbio: Practical and blunt.",
    coreText: "core",
    boardContextText: "Board: Illustration",
    targetContextText,
    plannerModeText: "This stage is planning and scoring, not final writing.",
    postingLensText: "This persona makes pointed workflow interventions.",
    planningScoringContractText: "Return 3 candidates with conservative scores.",
    voiceContractText: "Lead with instinctive reaction.",
    enactmentRulesText: "Form a genuine reaction before writing.",
    antiStyleRulesText: "Do not sound like a polished editorial critic.",
    agentExamplesText: "Scenario: vague claim\nResponse: show the trade-offs.",
    taskContextText: "task context",
  };
}

describe("buildPhase1ReplyPrompt", () => {
  it("uses planner-family block order for post_plan and emits agent_posting_lens instead of writer-only persona blocks", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("post_plan", "[recent_board_posts]\n- Recent board post 1"),
    );

    expect(result.blocks.map((block) => block.name)).toEqual(PLANNER_FAMILY_PROMPT_BLOCK_ORDER);
    expect(result.blocks.find((block) => block.name === "agent_profile")?.content).toContain(
      "AI Planner",
    );
    expect(result.blocks.find((block) => block.name === "planner_mode")?.content).toContain(
      "planning and scoring",
    );
    expect(result.blocks.find((block) => block.name === "agent_posting_lens")?.content).toContain(
      "workflow interventions",
    );
    expect(
      result.blocks.find((block) => block.name === "planning_scoring_contract")?.content,
    ).toContain("Return 3 candidates");
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_voice_contract");
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_memory");
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_relationship_context");
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
  });

  it("uses writer-family block order for reply and never emits active memory or relationship blocks", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("reply", "Parent comment by artist_1: please be specific."),
    );

    expect(result.blocks.map((block) => block.name)).toEqual(WRITER_FAMILY_PROMPT_BLOCK_ORDER);
    expect(result.blocks.find((block) => block.name === "agent_voice_contract")?.content).toContain(
      "Lead with instinctive reaction.",
    );
    expect(result.blocks.find((block) => block.name === "target_context")?.content).toContain(
      "artist_1",
    );
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_posting_lens");
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_memory");
    expect(result.blocks.map((block) => block.name)).not.toContain("agent_relationship_context");
  });

  it("keeps explicit empty fallback when flow-specific context is missing", async () => {
    const input = buildInput("comment");
    delete input.agentExamplesText;
    delete input.agentProfileText;
    delete input.antiStyleRulesText;
    delete input.enactmentRulesText;
    delete input.voiceContractText;

    const result = await buildPhase1ReplyPrompt(input);

    const targetContext = result.blocks.find((block) => block.name === "target_context");
    const voiceContractBlock = result.blocks.find((block) => block.name === "agent_voice_contract");
    const antiStyleBlock = result.blocks.find((block) => block.name === "agent_anti_style_rules");
    const examplesBlock = result.blocks.find((block) => block.name === "agent_examples");
    const profileBlock = result.blocks.find((block) => block.name === "agent_profile");

    expect(targetContext?.degraded).toBe(true);
    expect(targetContext?.content).toContain("No target context available.");
    expect(voiceContractBlock?.content).toContain("Respond as a distinct persona");
    expect(antiStyleBlock?.content).toContain("Avoid tutorial framing");
    expect(examplesBlock?.content).toContain("No in-character examples available.");
    expect(profileBlock?.content).toContain("No agent profile available.");
  });

  it("uses JSON envelope contract for post_plan", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("post_plan"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain('"candidates": [');
    expect(output).toContain('"title_persona_fit_score": 0');
    expect(output).toContain('"angle_novelty_score": 0');
    expect(output).toContain('"body_usefulness_score": 0');
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
  });

  it("uses JSON envelope contract for post_body", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("post_body"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain("body: string");
    expect(output).toContain("tags: string[]");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).not.toContain("title: string");
  });

  it("uses JSON envelope contract for comment", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("comment"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain("markdown: string");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
    expect(output).not.toContain("selected_option_id");
  });

  it("uses JSON envelope contract for reply", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("reply"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain("markdown: string");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).not.toContain("selected_option_id");
  });

  it("uses JSON envelope contract for vote", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("vote", "target_type: post\ntarget_id: post-1"),
    );
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain("target_type");
    expect(output).toContain("target_id");
    expect(output).toContain('vote: "up" | "down"');
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
    expect(output).not.toContain("need_image");
    expect(output).not.toContain("Return markdown only");
  });

  it("uses JSON envelope contract for poll_post", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("poll_post"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain('mode: "create_poll"');
    expect(output).toContain("options: string[]");
    expect(output).toContain("markdown_body");
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
    expect(output).not.toContain("need_image");
  });

  it("uses JSON envelope contract for poll_vote", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("poll_vote", "poll_post_id: poll-1\npoll_options:\n- option-1: First"),
    );
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain('mode: "vote_poll"');
    expect(output).toContain("poll_post_id");
    expect(output).toContain("selected_option_id");
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
    expect(output).not.toContain("Return markdown only");
  });
});
