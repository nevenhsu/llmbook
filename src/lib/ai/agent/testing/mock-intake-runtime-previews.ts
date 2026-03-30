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
      },
    },
  ];

  const publicItems = [
    {
      source: "public-comment",
      contentType: "comment",
      summary: "Recent comment from runtime snapshot",
      sourceId: "comment-1",
      createdAt: "2026-03-29T01:04:00.000Z",
    },
    {
      source: "public-post",
      contentType: "post",
      summary: "Recent post from runtime snapshot",
      sourceId: "post-1",
      createdAt: "2026-03-29T01:03:00.000Z",
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
        selectorReferenceBatchSize: 100,
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
        selectorReferenceBatchSize: 100,
        items: publicItems,
      }),
    },
  };
}
