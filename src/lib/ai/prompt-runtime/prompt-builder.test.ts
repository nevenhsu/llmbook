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
    soulText: "soul",
    memoryText: "memory",
    boardContextText: "Board: Illustration",
    targetContextText,
    taskContextText: "task context",
  };
}

describe("buildPhase1ReplyPrompt", () => {
  it("assembles blocks in fixed order with target_context before task_context", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("comment", "Parent comment by artist_1: please be specific."),
    );

    expect(result.blocks.map((block) => block.name)).toEqual(PHASE1_REPLY_PROMPT_BLOCK_ORDER);
    expect(result.blocks.find((block) => block.name === "target_context")?.content).toContain(
      "artist_1",
    );
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[1]?.role).toBe("user");
  });

  it("keeps explicit empty fallback when target context is missing", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("post"));

    const targetContext = result.blocks.find((block) => block.name === "target_context");

    expect(targetContext?.degraded).toBe(true);
    expect(targetContext?.content).toContain("No target context available.");
  });

  it("uses markdown plus structured image request contract for post", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("post"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return markdown only for the body content.");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).not.toContain("target_type");
  });

  it("uses markdown plus structured image request contract for comment", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("comment"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return markdown only for the body content.");
    expect(output).toContain("need_image");
    expect(output).toContain("image_prompt");
    expect(output).toContain("image_alt");
    expect(output).not.toContain("selected_option_id");
  });

  it("uses structured decision contract for vote", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("vote", "target_type: post\ntarget_id: post-1"),
    );
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return only a structured vote decision.");
    expect(output).toContain("target_type");
    expect(output).toContain("target_id");
    expect(output).toContain('vote: "up" | "down"');
    expect(output).not.toContain("need_image");
    expect(output).not.toContain("Return markdown only");
  });

  it("uses structured poll creation contract for poll_post", async () => {
    const result = await buildPhase1ReplyPrompt(buildInput("poll_post"));
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return only a structured poll creation payload.");
    expect(output).toContain('mode: "create_poll"');
    expect(output).toContain("options: string[]");
    expect(output).toContain("markdown_body");
    expect(output).not.toContain("need_image");
  });

  it("uses structured poll vote contract for poll_vote", async () => {
    const result = await buildPhase1ReplyPrompt(
      buildInput("poll_vote", "poll_post_id: poll-1\npoll_options:\n- option-1: First"),
    );
    const output =
      result.blocks.find((block) => block.name === "output_constraints")?.content ?? "";

    expect(output).toContain("Return only a structured poll vote payload.");
    expect(output).toContain('mode: "vote_poll"');
    expect(output).toContain("poll_post_id");
    expect(output).toContain("selected_option_id");
    expect(output).not.toContain("Return markdown only");
  });
});
