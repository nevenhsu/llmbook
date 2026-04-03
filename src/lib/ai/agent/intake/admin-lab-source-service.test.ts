import { describe, expect, it, vi } from "vitest";
import { AiAgentAdminLabSourceService } from "@/lib/ai/agent/intake/admin-lab-source-service";
import type { AiAgentRuntimeSourceSnapshot } from "@/lib/ai/agent/intake/intake-read-model";
import type { AiOppRow } from "@/lib/ai/agent/intake/opportunity-store";

function buildRuntimeSnapshot(kind: "public" | "notification"): AiAgentRuntimeSourceSnapshot {
  return {
    kind,
    statusLabel: "ready",
    sourceNames: kind === "public" ? ["posts", "comments"] : ["notifications"],
    items: [
      {
        source: kind === "public" ? "public-post" : "notification",
        contentType: kind === "public" ? "post" : "reply",
        summary:
          kind === "public"
            ? "Board: Creative Lab | Recent post title: Existing snapshot row"
            : "Unread mention from runtime snapshot",
        sourceId: kind === "public" ? "post-1" : "notification-1",
        createdAt: "2026-04-03T00:00:00.000Z",
        metadata:
          kind === "public"
            ? {
                boardId: "board-1",
                boardSlug: "creative-lab",
                postId: "post-1",
              }
            : {
                recipientPersonaId: "persona-orchid",
                boardId: "board-1",
                boardSlug: "creative-lab",
                postId: "post-1",
                commentId: "comment-1",
                context: "comment",
                notificationType: "mention",
              },
      },
    ],
    selectorInput: null,
  };
}

function buildOppRow(overrides: Partial<AiOppRow> = {}): AiOppRow {
  return {
    id: "opp-1",
    kind: "public",
    source_table: "posts",
    source_id: "post-1",
    board_id: "board-1",
    board_slug: "creative-lab",
    post_id: "post-1",
    comment_id: null,
    parent_comment_id: null,
    notification_id: null,
    recipient_persona_id: null,
    content_type: "post",
    summary: "Board: Creative Lab | Recent post title: Existing snapshot row",
    probability: null,
    selected: null,
    matched_persona_count: 0,
    notification_context: null,
    notification_type: null,
    notification_processed_at: null,
    probability_model_key: null,
    probability_prompt_version: null,
    probability_evaluated_at: null,
    source_created_at: "2026-04-03T00:00:00.000Z",
    created_at: "2026-04-03T00:10:00.000Z",
    updated_at: "2026-04-03T00:10:00.000Z",
    ...overrides,
  };
}

describe("AiAgentAdminLabSourceService", () => {
  it("syncs then queries ai_opps for public admin lab snapshots", async () => {
    const syncOpportunitySnapshot = vi.fn(async () => undefined);
    const ingestSnapshotOnly = vi.fn(async () => undefined);
    const service = new AiAgentAdminLabSourceService({
      deps: {
        loadConfig: async () => ({
          values: {
            selectorReferenceBatchSize: 10,
          },
        }),
        loadRuntimePreviewSet: async () => ({
          public: buildRuntimeSnapshot("public"),
          notification: buildRuntimeSnapshot("notification"),
        }),
        syncOpportunitySnapshot,
        ingestSnapshotOnly,
        listAdminLabOpportunities: async (kind) => {
          expect(kind).toBe("public");
          return [
            buildOppRow({
              probability: 0.81,
              selected: true,
            }),
          ];
        },
      },
    });

    const snapshot = await service.loadSnapshot({
      kind: "public",
      groupIndex: 2,
      score: true,
    });

    expect(syncOpportunitySnapshot).toHaveBeenCalledWith("public");
    expect(ingestSnapshotOnly).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({
      kind: "public",
      items: [
        {
          source: "public-post",
          contentType: "post",
          summary: "Board: Creative Lab | Recent post title: Existing snapshot row",
          sourceId: "post-1",
          metadata: {
            boardId: "board-1",
            boardSlug: "creative-lab",
            probability: 0.81,
            selected: true,
          },
        },
      ],
      selectorInput: {
        groupIndexOverride: 2,
        selectorReferenceBatchSize: 10,
        referenceWindow: {
          batchSize: 10,
          groupIndex: 2,
        },
      },
    });
  });

  it("ingests only and forces notification group index to zero for admin lab snapshots", async () => {
    const syncOpportunitySnapshot = vi.fn(async () => undefined);
    const ingestSnapshotOnly = vi.fn(async () => undefined);
    const notificationSnapshot = buildRuntimeSnapshot("notification");
    const service = new AiAgentAdminLabSourceService({
      deps: {
        loadConfig: async () => ({
          values: {
            selectorReferenceBatchSize: 6,
          },
        }),
        loadRuntimePreviewSet: async () => ({
          public: buildRuntimeSnapshot("public"),
          notification: notificationSnapshot,
        }),
        syncOpportunitySnapshot,
        ingestSnapshotOnly,
        listAdminLabOpportunities: async () => [
          buildOppRow({
            id: "opp-n1",
            kind: "notification",
            source_table: "notifications",
            source_id: "notification-1",
            board_slug: "creative-lab",
            post_id: "post-1",
            comment_id: "comment-1",
            notification_id: "notification-1",
            recipient_persona_id: "persona-orchid",
            content_type: "reply",
            summary: "Unread mention from runtime snapshot",
            probability: null,
            selected: null,
            notification_context: "comment",
            notification_type: "mention",
          }),
        ],
      },
    });

    const snapshot = await service.loadSnapshot({
      kind: "notification",
      batchSize: 4,
      groupIndex: 9,
      score: false,
    });

    expect(syncOpportunitySnapshot).not.toHaveBeenCalled();
    expect(ingestSnapshotOnly).toHaveBeenCalledWith({
      kind: "notification",
      snapshot: notificationSnapshot,
    });
    expect(snapshot?.selectorInput).toMatchObject({
      groupIndexOverride: 0,
      selectorReferenceBatchSize: 4,
      referenceWindow: {
        batchSize: 4,
        groupIndex: 0,
      },
    });
    expect(snapshot?.items[0]?.metadata).toMatchObject({
      recipientPersonaId: "persona-orchid",
      commentId: "comment-1",
      context: "comment",
      notificationType: "mention",
    });
  });
});
