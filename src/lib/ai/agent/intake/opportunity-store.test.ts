import { describe, expect, it } from "vitest";
import {
  AiOpportunityStore,
  type AiOppGroupRow,
  type AiOppRow,
  type AiOppUpsertInput,
} from "@/lib/ai/agent/intake/opportunity-store";

function buildOpp(overrides: Partial<AiOppRow> = {}): AiOppRow {
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
    summary: "Board: Creative Lab | Recent post title: A",
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
    created_at: "2026-04-03T00:00:00.000Z",
    updated_at: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function buildUpsert(overrides: Partial<AiOppUpsertInput> = {}): AiOppUpsertInput {
  return {
    kind: "public",
    sourceTable: "posts",
    sourceId: "post-1",
    boardId: "board-1",
    boardSlug: "creative-lab",
    postId: "post-1",
    commentId: null,
    parentCommentId: null,
    notificationId: null,
    recipientPersonaId: null,
    contentType: "post",
    summary: "Board: Creative Lab | Recent post title: A",
    notificationContext: null,
    notificationType: null,
    sourceCreatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

describe("AiOpportunityStore", () => {
  it("ingests opportunity rows with duplicate-skip semantics", async () => {
    const insertedPayloads: AiOppUpsertInput[][] = [];
    const store = new AiOpportunityStore({
      deps: {
        insertIgnoreExisting: async (rows) => {
          insertedPayloads.push(rows);
          return 1;
        },
      },
    });

    await expect(
      store.ingestOpportunities([
        buildUpsert(),
        buildUpsert({ sourceId: "comment-1", sourceTable: "comments", contentType: "comment" }),
      ]),
    ).resolves.toBe(1);

    expect(insertedPayloads).toEqual([
      [
        buildUpsert(),
        buildUpsert({ sourceId: "comment-1", sourceTable: "comments", contentType: "comment" }),
      ],
    ]);
  });

  it("queries the runtime public working set using cycle limit and persona limit", async () => {
    const store = new AiOpportunityStore({
      deps: {
        listRuntimeOpportunityCycleRows: async (input) => {
          expect(input).toEqual({
            kind: "public",
            cycleLimit: 100,
            publicPersonaLimit: 3,
          });
          return [buildOpp()];
        },
      },
    });

    await expect(
      store.listRuntimeOpportunityCycleRows({
        kind: "public",
        cycleLimit: 100,
        publicPersonaLimit: 3,
      }),
    ).resolves.toEqual([buildOpp()]);
  });

  it("queries only selected public opportunities below the persona cap and not yet processed for the current group", async () => {
    const store = new AiOpportunityStore({
      deps: {
        listEligiblePublicCandidateOpportunities: async (input) => {
          expect(input).toEqual({
            candidateEpoch: 2,
            groupIndex: 1,
            batchSize: 10,
            cycleLimit: 100,
            publicPersonaLimit: 3,
          });
          return [
            buildOpp({
              id: "opp-2",
              probability: 0.88,
              selected: true,
              matched_persona_count: 2,
            }),
          ];
        },
      },
    });

    await expect(
      store.listEligiblePublicCandidateOpportunities({
        candidateEpoch: 2,
        groupIndex: 1,
        batchSize: 10,
        cycleLimit: 100,
        publicPersonaLimit: 3,
      }),
    ).resolves.toEqual([
      buildOpp({
        id: "opp-2",
        probability: 0.88,
        selected: true,
        matched_persona_count: 2,
      }),
    ]);
  });

  it("queries only selected unprocessed notification opportunities for direct task materialization", async () => {
    const store = new AiOpportunityStore({
      deps: {
        listSelectedNotificationOpportunities: async (input) => {
          expect(input).toEqual({
            cycleLimit: 100,
          });
          return [
            buildOpp({
              id: "opp-n1",
              kind: "notification",
              source_table: "notifications",
              source_id: "notif-1",
              notification_id: "notif-1",
              recipient_persona_id: "persona-1",
              content_type: "reply",
              probability: 0.91,
              selected: true,
            }),
          ];
        },
      },
    });

    await expect(store.listSelectedNotificationOpportunities({ cycleLimit: 100 })).resolves.toEqual(
      [
        buildOpp({
          id: "opp-n1",
          kind: "notification",
          source_table: "notifications",
          source_id: "notif-1",
          notification_id: "notif-1",
          recipient_persona_id: "persona-1",
          content_type: "reply",
          probability: 0.91,
          selected: true,
        }),
      ],
    );
  });

  it("updates probability and derived selected state without failing when overlap writes occur", async () => {
    const persisted: Array<Record<string, unknown>> = [];
    const store = new AiOpportunityStore({
      deps: {
        updateOpportunityProbabilities: async (rows) => {
          persisted.push(...rows);
        },
      },
    });

    await store.updateOpportunityProbabilities([
      {
        opportunityId: "opp-1",
        probability: 0.88,
        probabilityModelKey: "gpt-5.4",
        probabilityPromptVersion: "opps-v1",
        evaluatedAt: "2026-04-03T00:10:00.000Z",
      },
      {
        opportunityId: "opp-2",
        probability: 0.42,
        probabilityModelKey: "gpt-5.4",
        probabilityPromptVersion: "opps-v1",
        evaluatedAt: "2026-04-03T00:10:00.000Z",
      },
    ]);

    expect(persisted).toEqual([
      {
        opportunityId: "opp-1",
        probability: 0.88,
        probabilityModelKey: "gpt-5.4",
        probabilityPromptVersion: "opps-v1",
        evaluatedAt: "2026-04-03T00:10:00.000Z",
      },
      {
        opportunityId: "opp-2",
        probability: 0.42,
        probabilityModelKey: "gpt-5.4",
        probabilityPromptVersion: "opps-v1",
        evaluatedAt: "2026-04-03T00:10:00.000Z",
      },
    ]);
  });

  it("persists processed public group rows and keeps matched persona count cumulative", async () => {
    const insertedGroups: AiOppGroupRow[] = [];
    const matchedCounts: Array<{ opportunityId: string; matchedPersonaCount: number }> = [];
    const store = new AiOpportunityStore({
      deps: {
        insertOppGroups: async (rows) => {
          insertedGroups.push(...rows);
        },
        updateMatchedPersonaCounts: async (rows) => {
          matchedCounts.push(...rows);
        },
      },
    });

    await store.recordPublicCandidateResults({
      groups: [
        {
          oppId: "opp-1",
          candidateEpoch: 0,
          groupIndex: 0,
          batchSize: 10,
          selectedSpeakers: [
            { name: "David Bowie", probability: 0.81 },
            { name: "Laurie Anderson", probability: 0.77 },
          ],
          resolvedPersonaIds: ["persona-1", "persona-2"],
        },
      ],
      matchedPersonaCounts: [{ opportunityId: "opp-1", matchedPersonaCount: 2 }],
    });

    expect(insertedGroups).toEqual([
      {
        oppId: "opp-1",
        candidateEpoch: 0,
        groupIndex: 0,
        batchSize: 10,
        selectedSpeakers: [
          { name: "David Bowie", probability: 0.81 },
          { name: "Laurie Anderson", probability: 0.77 },
        ],
        resolvedPersonaIds: ["persona-1", "persona-2"],
      },
    ]);
    expect(matchedCounts).toEqual([{ opportunityId: "opp-1", matchedPersonaCount: 2 }]);
  });

  it("loads cumulative resolved persona ids per opportunity from ai_opp_groups history", async () => {
    const store = new AiOpportunityStore({
      deps: {
        listResolvedPersonaIdsByOpportunityIds: async (opportunityIds) => {
          expect(opportunityIds).toEqual(["opp-1", "opp-2"]);
          return {
            "opp-1": ["persona-a", "persona-b"],
            "opp-2": ["persona-c"],
          };
        },
      },
    });

    await expect(store.listResolvedPersonaIdsByOpportunityIds(["opp-1", "opp-2"])).resolves.toEqual(
      {
        "opp-1": ["persona-a", "persona-b"],
        "opp-2": ["persona-c"],
      },
    );
  });

  it("marks selected notification opportunities as processed after downstream handling", async () => {
    const processedIds: string[][] = [];
    const store = new AiOpportunityStore({
      deps: {
        markNotificationsProcessed: async (opportunityIds) => {
          processedIds.push(opportunityIds);
        },
      },
    });

    await store.markNotificationsProcessed(["opp-n1", "opp-n2"]);

    expect(processedIds).toEqual([["opp-n1", "opp-n2"]]);
  });
});
