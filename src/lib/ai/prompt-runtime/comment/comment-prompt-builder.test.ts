import { describe, expect, it } from "vitest";
import {
  COMMENT_PROMPT_BLOCK_ORDER,
  buildCommentOwnedPromptBlockContent,
  buildCommentStageContentModePolicy,
  buildCommentStageOutputContract,
  renderCommentTargetContext,
} from "./comment-prompt-builder";

describe("comment prompt builder", () => {
  it("exposes post-shaped canonical block order", () => {
    expect(COMMENT_PROMPT_BLOCK_ORDER).toEqual([
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

  it("preserves upstream task_context text when assembling flow-owned blocks", () => {
    const blocks = buildCommentOwnedPromptBlockContent({
      flow: "comment",
      stage: "comment_body",
      contentMode: "discussion",
      targetContext: "Target context from upstream builder",
      taskContext: "Merged task context with extra runtime instructions",
    });

    expect(blocks.target_context).toContain("Target context from upstream builder");
    expect(blocks.task_context).toBe("Merged task context with extra runtime instructions");
    expect(blocks.action_mode_policy).toContain(
      "TODO(comment/comment_body/action_mode_policy/discussion)",
    );
  });

  it("switches discussion vs story content-mode and output guidance", () => {
    const discussionPolicy = buildCommentStageContentModePolicy({
      stage: "comment_body",
      contentMode: "discussion",
    });
    const storyPolicy = buildCommentStageContentModePolicy({
      stage: "comment_body",
      contentMode: "story",
    });
    const storyContract = buildCommentStageOutputContract({
      stage: "comment_body",
      contentMode: "story",
    });

    expect(discussionPolicy).toContain("Content mode: discussion.");
    expect(discussionPolicy.toLowerCase()).toContain("top-level");
    expect(storyPolicy).toContain("Content mode: story.");
    expect(storyPolicy).toContain("story fragment");
    expect(storyContract).toContain("Story mode:");
    expect(discussionPolicy).toContain("TODO(comment/comment_body/content_mode_policy/discussion)");
    expect(storyContract).toContain("TODO(comment/comment_body/output_contract/story)");
  });

  it("renders root post and recent top-level comments in the owned target-context shape", () => {
    const targetContext = renderCommentTargetContext({
      rootPost: {
        title: "Root Title",
        bodyExcerpt: "A bounded root-post excerpt.",
      },
      recentTopLevelComments: [
        {
          authorName: "ai_orchid",
          bodyExcerpt: "First top-level comment excerpt.",
        },
      ],
    });

    expect(targetContext).toContain("[root_post]");
    expect(targetContext).toContain("Title: Root Title");
    expect(targetContext).toContain("[recent_top_level_comments]");
    expect(targetContext).toContain("[ai_orchid]: First top-level comment excerpt.");
  });
});
