import { describe, expect, it } from "vitest";
import {
  REPLY_PROMPT_BLOCK_ORDER,
  buildReplyOwnedPromptBlockContent,
  buildReplyStageContentModePolicy,
  buildReplyStageOutputContract,
  renderReplyTargetContext,
} from "./reply-prompt-builder";

describe("reply prompt builder", () => {
  it("exposes post-shaped canonical block order", () => {
    expect(REPLY_PROMPT_BLOCK_ORDER).toEqual([
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
    const blocks = buildReplyOwnedPromptBlockContent({
      flow: "reply",
      stage: "reply_body",
      contentMode: "discussion",
      targetContext: "Reply target context from upstream builder",
      taskContext: "Merged reply task context with extra runtime instructions",
    });

    expect(blocks.target_context).toContain("Reply target context from upstream builder");
    expect(blocks.task_context).toBe("Merged reply task context with extra runtime instructions");
    expect(blocks.action_mode_policy).toContain(
      "TODO(reply/reply_body/action_mode_policy/discussion)",
    );
  });

  it("switches discussion vs story content-mode and output guidance", () => {
    const discussionPolicy = buildReplyStageContentModePolicy({
      stage: "reply_body",
      contentMode: "discussion",
    });
    const storyPolicy = buildReplyStageContentModePolicy({
      stage: "reply_body",
      contentMode: "story",
    });
    const storyContract = buildReplyStageOutputContract({
      stage: "reply_body",
      contentMode: "story",
    });

    expect(discussionPolicy).toContain("Content mode: discussion.");
    expect(discussionPolicy).toContain("Respond directly to the source comment.");
    expect(storyPolicy).toContain("Content mode: story.");
    expect(storyPolicy).toContain("in-thread story fragment");
    expect(storyContract).toContain("Story mode:");
    expect(discussionPolicy).toContain("TODO(reply/reply_body/content_mode_policy/discussion)");
    expect(storyContract).toContain("TODO(reply/reply_body/output_contract/story)");
  });

  it("renders source, ancestor, and recent top-level thread context in the owned shape", () => {
    const targetContext = renderReplyTargetContext({
      rootPost: {
        title: "Root Title",
        bodyExcerpt: "A bounded root-post excerpt.",
      },
      sourceComment: {
        authorName: "artist_2",
        bodyExcerpt: "Source comment excerpt.",
      },
      ancestorComments: [
        {
          authorName: "artist_1",
          bodyExcerpt: "Ancestor comment excerpt.",
        },
      ],
      recentTopLevelComments: [
        {
          authorName: "ai_orchid",
          bodyExcerpt: "Recent top-level comment excerpt.",
        },
      ],
    });

    expect(targetContext).toContain("[root_post]");
    expect(targetContext).toContain("[source_comment]");
    expect(targetContext).toContain("[ancestor_comments]");
    expect(targetContext).toContain("[recent_top_level_comments]");
    expect(targetContext).toContain("[artist_2]: Source comment excerpt.");
    expect(targetContext).toContain("[artist_1]: Ancestor comment excerpt.");
    expect(targetContext).toContain("[ai_orchid]: Recent top-level comment excerpt.");
  });
});
