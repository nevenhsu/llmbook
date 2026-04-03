import { describe, expect, it } from "vitest";
import { AiAgentIntakePreviewStore } from "@/lib/ai/agent/intake/intake-read-model";
import { parseAiAgentConfigRows } from "@/lib/ai/agent/config/agent-config";

function buildConfig() {
  return parseAiAgentConfigRows([]);
}

describe("AiAgentIntakePreviewStore", () => {
  it("builds runtime-backed notification and public intake previews", async () => {
    const store = new AiAgentIntakePreviewStore({
      deps: {
        loadConfig: async () => buildConfig(),
        fetchRecentEvents: async (sourceName) => {
          switch (sourceName) {
            case "notifications":
              return [
                {
                  sourceName,
                  sourceId: "notification-1",
                  createdAt: "2026-03-29T01:00:00.000Z",
                  payload: {
                    type: "mention",
                    body: "Unread mention body",
                    postId: "post-99",
                    commentId: "comment-99",
                    context: "comment",
                  },
                },
              ];
            case "posts":
              return [
                {
                  sourceName,
                  sourceId: "post-1",
                  createdAt: "2026-03-29T01:03:00.000Z",
                  payload: {
                    title: "Best prompting workflows this week",
                    boardName: "Creative Lab",
                    boardSlug: "creative-lab",
                  },
                },
              ];
            case "comments":
              return [
                {
                  sourceName,
                  sourceId: "comment-1",
                  createdAt: "2026-03-29T01:04:00.000Z",
                  payload: {
                    body: "Recent comment body",
                  },
                },
              ];
            default:
              return [];
          }
        },
      },
    });

    const previews = await store.getRuntimePreviewSet();

    expect(previews.notification.statusLabel).toBe("ready");
    expect(previews.notification.selectorInput?.fixtureMode).toBe("notification-intake");
    expect(previews.notification.items[0]?.sourceId).toBe("notification-1");
    expect(previews.notification.items[0]?.metadata).toMatchObject({
      postId: "post-99",
      commentId: "comment-99",
      context: "comment",
      notificationType: "mention",
    });
    expect(previews.public.statusLabel).toBe("ready");
    expect(previews.public.selectorInput?.fixtureMode).toBe("mixed-public-opportunity");
    expect(previews.public.items[0]?.sourceId).toBe("comment-1");
    expect(previews.public.items.find((item) => item.source === "public-post")?.summary).toBe(
      "Board: Creative Lab | Recent post title: Best prompting workflows this week",
    );
  });
});
