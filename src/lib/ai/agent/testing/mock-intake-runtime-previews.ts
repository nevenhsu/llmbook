import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import { buildSelectorInputPreview } from "@/lib/ai/agent/intake/intake-preview";

export function buildMockIntakeRuntimePreviews(): {
  notification: AiAgentRuntimeSourceSnapshot;
  public: AiAgentRuntimeSourceSnapshot;
} {
  const notificationItems = [
    {
      source: "notification",
      contentType: "mention",
      summary: "Unread mention from runtime snapshot",
      sourceId: "notification-1",
      createdAt: "2026-03-29T01:00:00.000Z",
      metadata: {
        postId: "post-1",
        commentId: null,
        parentCommentId: null,
        context: "post",
        notificationType: "mention",
        boardSlug: "creative-lab",
        recipientPersonaId: "persona-orchid",
        probability: 0.92,
        selected: true,
      },
    },
  ];

  const publicItems = [
    {
      source: "public-comment",
      contentType: "comment",
      summary:
        "Board: Creative Lab | Recent comment: Can anyone share concrete workflow examples for this tool stack?",
      sourceId: "comment-1",
      createdAt: "2026-03-29T01:04:00.000Z",
      metadata: {
        postId: "post-1",
        commentId: "comment-1",
        parentCommentId: null,
        boardId: "board-1",
        boardName: "Creative Lab",
        boardSlug: "creative-lab",
        probability: 0.67,
        selected: true,
      },
    },
    {
      source: "public-post",
      contentType: "post",
      summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
      sourceId: "post-1",
      createdAt: "2026-03-29T01:03:00.000Z",
      metadata: {
        boardId: "board-1",
        boardName: "Creative Lab",
        boardSlug: "creative-lab",
        postId: "post-1",
        probability: 0.77,
        selected: true,
      },
    },
    {
      source: "public-comment",
      contentType: "comment",
      summary:
        "Board: Creative Lab | Recent comment: Low-signal side thread with vague reactions and no clear next step.",
      sourceId: "comment-2",
      createdAt: "2026-03-29T01:02:00.000Z",
      metadata: {
        postId: "post-1",
        commentId: "comment-2",
        parentCommentId: null,
        boardId: "board-1",
        boardName: "Creative Lab",
        boardSlug: "creative-lab",
        probability: 0.35,
        selected: false,
      },
    },
  ];

  return {
    notification: {
      kind: "notification",
      statusLabel: "ready",
      sourceNames: ["notifications"],
      items: notificationItems,
      selectorInput: buildSelectorInputPreview({
        fixtureMode: "notification-intake",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        items: notificationItems,
      }),
    },
    public: {
      kind: "public",
      statusLabel: "ready",
      sourceNames: ["posts", "comments"],
      items: publicItems,
      selectorInput: buildSelectorInputPreview({
        fixtureMode: "mixed-public-opportunity",
        groupIndexOverride: 0,
        selectorReferenceBatchSize: 10,
        items: publicItems,
      }),
    },
  };
}
