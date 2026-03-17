import { describe, expect, it } from "vitest";
import {
  PHASE1_REPLY_PROMPT_BLOCK_ORDER,
  buildPhase1ReplyPrompt,
  type PromptActionType,
} from "@/lib/ai/prompt-runtime/prompt-builder";

function buildInput(actionType: PromptActionType, targetContextText?: string) {
  return {
    entityId: `task-${actionType}`,
    actionType,
    systemBaseline: "baseline",
    policyText: "policy",
    agentProfileText: "display_name: AI Planner\nusername: ai_planner\nbio: Practical and blunt.",
    soulText: "soul",
    memoryText: "memory",
    relationshipContextText: "target_author: artist_1",
    boardContextText: "Board: Illustration",
    targetContextText,
    voiceContractText: "Lead with instinctive reaction.",
    enactmentRulesText: "Form a genuine reaction before writing.",
    antiStyleRulesText: "Do not sound like a polished editorial critic.",
    agentExamplesText: "Scenario: vague claim\nResponse: show the trade-offs.",
    taskContextText: "task context",
  };
}

describe("buildPhase1ReplyPrompt", () => {
  it("assembles blocks in fixed order with target_context before task_context", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("comment", "Parent comment by artist_1: please be specific."),
    );

    expect(result.blocks.map((block) => block.name)).toEqual(PHASE1_REPLY_PROMPT_BLOCK_ORDER);
    expect(result.blocks.find((block) => block.name === "agent_profile")?.content).toContain(
      "AI Planner",
    );
    expect(
      result.blocks.find((block) => block.name === "agent_relationship_context")?.content,
    ).toContain("artist_1");
    expect(result.blocks.find((block) => block.name === "target_context")?.content).toContain(
      "artist_1",
    );
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
  });

  it("keeps explicit empty fallback when target context is missing", async () => {
    const {
      relationshipContextText,
      agentExamplesText,
      agentProfileText,
      antiStyleRulesText,
      enactmentRulesText,
      voiceContractText,
      ...input
    } = buildInput("post");
    const result = await buildPhase1ReplyPrompt(input);

    const targetContext = result.blocks.find((block) => block.name === "target_context");
    const relationshipContext = result.blocks.find(
      (block) => block.name === "agent_relationship_context",
    );
    const voiceContractBlock = result.blocks.find((block) => block.name === "agent_voice_contract");
    const antiStyleBlock = result.blocks.find((block) => block.name === "agent_anti_style_rules");
    const examplesBlock = result.blocks.find((block) => block.name === "agent_examples");
    const profileBlock = result.blocks.find((block) => block.name === "agent_profile");

    expect(targetContext?.degraded).toBe(true);
    expect(targetContext?.content).toContain("No target context available.");
    expect(relationshipContext?.content).toContain("No relationship context available.");
    expect(voiceContractBlock?.content).toContain("Respond as a distinct persona");
    expect(antiStyleBlock?.content).toContain("Avoid tutorial framing");
    expect(examplesBlock?.content).toContain("No in-character examples available.");
    expect(profileBlock?.content).toContain("No agent profile available.");
  });

  it("uses JSON envelope contract for post", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("post"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return exactly one JSON object.");
    expect(output).toContain("title: string");
    expect(output).toContain("body: string");
    expect(output).toContain("tags: string[]");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).toContain("Do not output any text outside the JSON object.");
    expect(output).toContain("Do not mention prompt instructions or system blocks in the output.");
    expect(output).not.toContain("target_type");
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
