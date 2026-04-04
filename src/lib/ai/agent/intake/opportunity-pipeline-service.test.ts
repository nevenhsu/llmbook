import { describe, expect, it, vi } from "vitest";
import type { AiOppRow } from "@/lib/ai/agent/intake/opportunity-store";
import {
  AiAgentOpportunityPipelineService,
  type AiAgentOpportunityPipelineExecutedResponse,
  type AiAgentOpportunityPipelineEvent,
} from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import { buildMockIntakeRuntimePreviews } from "@/lib/ai/agent/testing/mock-intake-runtime-previews";

function buildOpp(overrides: Partial<AiOppRow> = {}): AiOppRow {
  return {
    id: "opp-1",
    kind: "notification",
    source_table: "notifications",
    source_id: "notification-1",
    board_id: null,
    board_slug: null,
    post_id: "post-1",
    comment_id: null,
    parent_comment_id: null,
    notification_id: "notification-1",
    recipient_persona_id: "persona-orchid",
    content_type: "comment",
    summary: "Unread mention from runtime snapshot",
    probability: null,
    selected: null,
    matched_persona_count: 0,
    notification_context: "post",
    notification_type: "mention",
    notification_processed_at: null,
    probability_model_key: null,
    probability_prompt_version: null,
    probability_evaluated_at: null,
    source_created_at: "2026-03-29T01:00:00.000Z",
    created_at: "2026-04-03T00:00:00.000Z",
    updated_at: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function buildExecuted(
  kind: "notification" | "public",
): AiAgentOpportunityPipelineExecutedResponse {
  return {
    mode: "executed",
    kind,
    message: `${kind} pipeline executed`,
    injectionPreview: {
      rpcName: "inject_persona_tasks",
      summary: {
        candidateCount: 0,
        insertedCount: 0,
        skippedCount: 0,
        insertedTaskIds: [],
        skippedReasonCounts: {},
      },
      results: [],
    },
    insertedTasks: [],
  };
}

function buildRuntimeConfig(
  overrides: Partial<{
    selectorReferenceBatchSize: number;
    publicOpportunityCycleLimit: number;
    publicOpportunityPersonaLimit: number;
    postOpportunityCooldownMinutes: number;
    commentOpportunityCooldownMinutes: number;
  }> = {},
) {
  return {
    selectorReferenceBatchSize: 10,
    publicOpportunityCycleLimit: 100,
    publicOpportunityPersonaLimit: 3,
    postOpportunityCooldownMinutes: 360,
    commentOpportunityCooldownMinutes: 30,
    ...overrides,
  };
}

describe("AiAgentOpportunityPipelineService", () => {
  it("ingests, scores, and materializes selected notification opportunities from ai_opps", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const ingestOpportunities = vi.fn(async () => 1);
    const listRuntimeOpportunityCycleRows = vi.fn(async () => [buildOpp()]);
    const updateOpportunityProbabilities = vi.fn(async () => undefined);
    const scoreOpportunityProbabilities = vi.fn(async () => [
      {
        opportunityId: "opp-1",
        probability: 0.61,
        probabilityModelKey: "mock:opportunities",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T10:00:00.000Z",
      },
    ]);
    const listSelectedNotificationOpportunities = vi.fn(async () => [
      buildOpp({
        probability: 0.61,
        selected: true,
      }),
    ]);
    const loadPersonaIdentities = vi.fn(async () => ({
      "persona-orchid": {
        personaId: "persona-orchid",
        username: "ai_orchid",
      },
    }));
    const executeCandidates = vi.fn(
      async (input: {
        kind?: "notification" | "public" | "manual";
        candidates: Array<{ payload: Record<string, unknown> }>;
      }) => {
        expect(input.kind).toBe("notification");
        expect(input.candidates).toHaveLength(1);
        expect(input.candidates[0]?.payload).toMatchObject({
          summary: "Unread mention from runtime snapshot",
          postId: "post-1",
          commentId: null,
          parentCommentId: null,
          context: "post",
          notificationType: "mention",
        });

        return {
          mode: "executed" as const,
          kind: "notification" as const,
          message: "notification pipeline executed",
          injectionPreview: null as never,
          insertedTasks: [{ id: "task-1" } as never],
        };
      },
    );
    const markNotificationsProcessed = vi.fn(async () => undefined);
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities,
        listRuntimeOpportunityCycleRows,
        updateOpportunityProbabilities,
        loadPersonaActivity: async () => ({
          "persona-orchid": true,
        }),
        scoreOpportunityProbabilities,
        listSelectedNotificationOpportunities,
        loadPersonaIdentities,
        executeCandidates,
        markNotificationsProcessed,
      },
    });

    await expect(service.executeFlow({ kind: "notification" })).resolves.toMatchObject({
      kind: "notification",
      insertedTasks: [{ id: "task-1" }],
    });

    expect(ingestOpportunities).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "notification",
        sourceTable: "notifications",
        sourceId: "notification-1",
        postId: "post-1",
        parentCommentId: null,
        notificationContext: "post",
        notificationType: "mention",
      }),
    ]);
    expect(listRuntimeOpportunityCycleRows).toHaveBeenCalledWith({
      kind: "notification",
      cycleLimit: 100,
      publicPersonaLimit: 3,
    });
    expect(scoreOpportunityProbabilities).toHaveBeenCalledWith({
      kind: "notification",
      rows: [buildOpp()],
    });
    expect(updateOpportunityProbabilities).toHaveBeenCalledWith([
      {
        opportunityId: "opp-1",
        probability: 0.61,
        probabilityModelKey: "mock:opportunities",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T10:00:00.000Z",
      },
    ]);
    expect(listSelectedNotificationOpportunities).toHaveBeenCalledTimes(1);
    expect(loadPersonaIdentities).toHaveBeenCalledWith(["persona-orchid"]);
    expect(markNotificationsProcessed).toHaveBeenCalledWith(["opp-1"]);
  });

  it("filters inactive notification recipients before opportunities scoring", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const scoreOpportunityProbabilities = vi.fn(async () => [
      {
        opportunityId: "opp-1",
        probability: 0.61,
        probabilityModelKey: "mock:opportunities",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T10:00:00.000Z",
      },
    ]);
    const updateOpportunityProbabilities = vi.fn(async () => undefined);
    const executeCandidates = vi.fn(async () => buildExecuted("notification"));
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 1,
        listRuntimeOpportunityCycleRows: async () => [buildOpp()],
        loadPersonaActivity: async () => ({
          "persona-orchid": false,
        }),
        scoreOpportunityProbabilities,
        updateOpportunityProbabilities,
        listSelectedNotificationOpportunities: async () => [],
        loadPersonaIdentities: async () => ({}),
        executeCandidates,
        markNotificationsProcessed: async () => undefined,
      },
    });

    await expect(service.executeFlow({ kind: "notification" })).resolves.toMatchObject({
      kind: "notification",
      insertedTasks: [],
    });

    expect(scoreOpportunityProbabilities).not.toHaveBeenCalled();
    expect(updateOpportunityProbabilities).toHaveBeenCalledWith([
      {
        opportunityId: "opp-1",
        probability: 0,
        probabilityModelKey: "system:notification-recipient-inactive",
        probabilityPromptVersion: "notification-recipient-active-v1",
        evaluatedAt: expect.any(String),
      },
    ]);
    expect(executeCandidates).not.toHaveBeenCalled();
  });

  it("skips selected notification rows whose recipient persona became inactive", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const updateOpportunityProbabilities = vi.fn(async () => undefined);
    const executeCandidates = vi.fn(async () => buildExecuted("notification"));
    const markNotificationsProcessed = vi.fn(async () => undefined);
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 0,
        listRuntimeOpportunityCycleRows: async () => [],
        loadPersonaActivity: async () => ({
          "persona-orchid": false,
        }),
        scoreOpportunityProbabilities: async () => [],
        updateOpportunityProbabilities,
        listSelectedNotificationOpportunities: async () => [
          buildOpp({
            probability: 0.91,
            selected: true,
          }),
        ],
        loadPersonaIdentities: async () => ({
          "persona-orchid": {
            personaId: "persona-orchid",
            username: "ai_orchid",
          },
        }),
        executeCandidates,
        markNotificationsProcessed,
      },
    });

    await expect(service.executeFlow({ kind: "notification" })).resolves.toMatchObject({
      kind: "notification",
      insertedTasks: [],
    });

    expect(updateOpportunityProbabilities).toHaveBeenCalledWith([
      {
        opportunityId: "opp-1",
        probability: 0,
        probabilityModelKey: "system:notification-recipient-inactive",
        probabilityPromptVersion: "notification-recipient-active-v1",
        evaluatedAt: expect.any(String),
      },
    ]);
    expect(executeCandidates).not.toHaveBeenCalled();
    expect(markNotificationsProcessed).not.toHaveBeenCalled();
  });

  it("returns admin notification batch results and auto-saves selected active rows", async () => {
    const executeCandidates = vi.fn(async (input) => ({
      mode: "executed" as const,
      kind: "notification" as const,
      message: "notification pipeline executed",
      injectionPreview: {
        rpcName: "inject_persona_tasks",
        summary: {
          candidateCount: 1,
          insertedCount: 1,
          skippedCount: 0,
          insertedTaskIds: ["task-1"],
          skippedReasonCounts: {},
        },
        results: [
          {
            candidateIndex: input.candidates[0]!.candidateIndex,
            inserted: true,
            skipReason: null,
            taskId: "task-1",
            taskType: "comment",
            dispatchKind: "notification",
            personaUsername: "ai_orchid",
            sourceTable: "notifications",
            sourceId: "notification-1",
          },
        ],
      },
      insertedTasks: [
        {
          id: "task-1",
          personaId: "persona-orchid",
          status: "PENDING",
          errorMessage: null,
        } as never,
      ],
    }));
    const markNotificationsProcessed = vi.fn(async () => undefined);
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        listOpportunitiesByIds: async () => [
          buildOpp(),
          buildOpp({
            id: "opp-2",
            source_id: "notification-2",
            notification_id: "notification-2",
            recipient_persona_id: "persona-inactive",
          }),
        ],
        loadPersonaActivity: async () => ({
          "persona-orchid": true,
          "persona-inactive": false,
        }),
        scoreOpportunityProbabilities: async () => [
          {
            opportunityId: "opp-1",
            probability: 0.87,
            probabilityModelKey: "mock:opportunities",
            probabilityPromptVersion: "runtime-opportunities-v2",
            evaluatedAt: "2026-04-03T10:00:00.000Z",
          },
        ],
        updateOpportunityProbabilities: async () => undefined,
        loadPersonaIdentities: async () => ({
          "persona-orchid": {
            personaId: "persona-orchid",
            username: "ai_orchid",
          },
        }),
        executeCandidates,
        markNotificationsProcessed,
      },
    });

    await expect(
      service.scoreAdminOpportunityBatch({
        kind: "notification",
        opportunityIds: ["opp-1", "opp-2"],
      }),
    ).resolves.toMatchObject({
      opportunityResults: [
        {
          opportunityId: "opp-2",
          probability: 0,
          selected: false,
        },
        {
          opportunityId: "opp-1",
          probability: 0.87,
          selected: true,
        },
      ],
      notificationAutoRoute: {
        taskOutcomes: [
          {
            opportunityId: "opp-1",
            personaId: "persona-orchid",
            inserted: true,
            taskId: "task-1",
          },
        ],
      },
    });

    expect(executeCandidates).toHaveBeenCalledTimes(1);
    expect(markNotificationsProcessed).toHaveBeenCalledWith(["opp-1"]);
  });

  it("can process selected persisted notification opportunities even when the current notification snapshot is empty", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => ({
          ...runtimePreviewSet,
          notification: {
            kind: "notification",
            statusLabel: "empty",
            sourceNames: ["notifications"],
            items: [],
            selectorInput: null,
          },
        }),
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 0,
        listRuntimeOpportunityCycleRows: async () => [],
        updateOpportunityProbabilities: async () => undefined,
        loadPersonaActivity: async () => ({
          "persona-orchid": true,
        }),
        scoreOpportunityProbabilities: async () => [],
        listSelectedNotificationOpportunities: async () => [
          buildOpp({
            probability: 0.91,
            selected: true,
            source_created_at: "2026-03-29T01:00:00.000Z",
          }),
        ],
        loadPersonaIdentities: async () => ({
          "persona-orchid": {
            personaId: "persona-orchid",
            username: "ai_orchid",
          },
        }),
        executeCandidates: async () => ({
          mode: "executed",
          kind: "notification",
          message: "notification pipeline executed",
          injectionPreview: null as never,
          insertedTasks: [{ id: "task-1" } as never],
        }),
        markNotificationsProcessed: async () => undefined,
      },
    });

    await expect(service.executeFlow({ kind: "notification" })).resolves.toMatchObject({
      kind: "notification",
      insertedTasks: [{ id: "task-1" }],
    });
  });

  it("persists each 10-row opportunities scoring batch immediately so earlier batches survive later failures", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const unscoredRows = Array.from({ length: 12 }, (_, index) =>
      buildOpp({
        id: `opp-public-${index + 1}`,
        kind: "public",
        source_table: "posts",
        source_id: `post-${index + 1}`,
        board_id: "board-1",
        post_id: `post-${index + 1}`,
        notification_id: null,
        recipient_persona_id: null,
        content_type: "post",
        summary: `Board: Creative Lab | Recent post title: Candidate ${index + 1}`,
        source_created_at: `2026-03-29T01:${String(index).padStart(2, "0")}:00.000Z`,
      }),
    );
    const scoreOpportunityProbabilities = vi
      .fn<
        (input: { kind: "notification" | "public"; rows: AiOppRow[] }) => Promise<
          Array<{
            opportunityId: string;
            probability: number;
            probabilityModelKey: string | null;
            probabilityPromptVersion: string | null;
            evaluatedAt: string;
          }>
        >
      >()
      .mockImplementationOnce(async ({ rows }) =>
        rows.map((row) => ({
          opportunityId: row.id,
          probability: 0.77,
          probabilityModelKey: "mock:opportunities",
          probabilityPromptVersion: "runtime-opportunities-v2",
          evaluatedAt: "2026-04-03T11:00:00.000Z",
        })),
      )
      .mockImplementationOnce(async () => {
        throw new Error("second batch failed");
      });
    const updateOpportunityProbabilities = vi.fn(async () => undefined);
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 12,
        listRuntimeOpportunityCycleRows: async (input) => {
          expect(input).toEqual({
            kind: "public",
            cycleLimit: 100,
            publicPersonaLimit: 3,
          });
          return unscoredRows;
        },
        scoreOpportunityProbabilities,
        updateOpportunityProbabilities,
        listSelectedNotificationOpportunities: async () => [],
        listEligiblePublicCandidateOpportunities: async () => [],
        listResolvedPersonaIdsByOpportunityIds: async () => ({}),
        selectPublicSpeakerCandidates: async () => [],
        recordPublicCandidateResults: async () => undefined,
        executeCandidates: async () => buildExecuted("public"),
        markNotificationsProcessed: async () => undefined,
        loadPublicRuntimeCursor: async () => ({
          groupIndex: 0,
          candidateEpoch: 0,
        }),
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie"],
          totalReferences: 1,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        advancePublicRuntimeCursor: async () => undefined,
      },
    });

    await expect(service.executeFlow({ kind: "public" })).rejects.toThrow("second batch failed");

    expect(scoreOpportunityProbabilities).toHaveBeenCalledTimes(2);
    expect(scoreOpportunityProbabilities.mock.calls[0]?.[0].rows).toHaveLength(10);
    expect(scoreOpportunityProbabilities.mock.calls[1]?.[0].rows).toHaveLength(2);
    expect(updateOpportunityProbabilities).toHaveBeenCalledTimes(1);
    expect(updateOpportunityProbabilities).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          opportunityId: "opp-public-1",
          probability: 0.77,
        }),
        expect.objectContaining({
          opportunityId: "opp-public-10",
          probability: 0.77,
        }),
      ]),
    );
  });

  it("ingests, scores, selects speakers, records group progress, and inserts persisted public tasks", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const ingestOpportunities = vi.fn(async () => 2);
    const listRuntimeOpportunityCycleRows = vi.fn(async () => {
      return [
        buildOpp({
          id: "opp-public-1",
          kind: "public",
          source_table: "posts",
          source_id: "post-1",
          board_id: "board-1",
          post_id: "post-1",
          notification_id: null,
          recipient_persona_id: null,
          content_type: "post",
          summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
          source_created_at: "2026-03-29T01:03:00.000Z",
        }),
      ];
    });
    const updateOpportunityProbabilities = vi.fn(async () => undefined);
    const scoreOpportunityProbabilities = vi.fn(async () => [
      {
        opportunityId: "opp-public-1",
        probability: 0.74,
        probabilityModelKey: "mock:opportunities",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T10:00:00.000Z",
      },
    ]);
    const loadPublicRuntimeCursor = vi.fn(async () => ({
      groupIndex: 2,
      candidateEpoch: 0,
    }));
    const loadReferenceBatch = vi.fn(async () => ({
      referenceNames: ["David Bowie", "Laurie Anderson", "Grace Jones"],
      totalReferences: 3,
      effectiveGroupIndex: 0,
      batchSize: 10,
    }));
    const listEligiblePublicCandidateOpportunities = vi.fn(async () => [
      buildOpp({
        id: "opp-public-1",
        kind: "public",
        source_table: "posts",
        source_id: "post-1",
        board_id: "board-1",
        post_id: "post-1",
        notification_id: null,
        recipient_persona_id: null,
        content_type: "post",
        summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
        probability: 0.81,
        selected: true,
        matched_persona_count: 1,
        notification_context: null,
        notification_type: null,
        source_created_at: "2026-03-29T01:03:00.000Z",
      }),
    ]);
    const listResolvedPersonaIdsByOpportunityIds = vi.fn(async () => ({
      "opp-public-1": ["persona-orchid"],
    }));
    const selectPublicSpeakerCandidates = vi.fn(async () => [
      {
        oppId: "opp-public-1",
        selectedSpeakers: [
          { name: "David Bowie", probability: 0.91 },
          { name: "Laurie Anderson", probability: 0.73 },
          { name: "Grace Jones", probability: 0.58 },
        ],
      },
    ]);
    const resolveSpeakerPersonas = vi.fn(async () => [
      {
        referenceName: "David Bowie",
        personaId: "persona-marlowe",
        username: "ai_marlowe",
        active: true,
      },
      {
        referenceName: "Laurie Anderson",
        personaId: "persona-halo",
        username: "ai_halo",
        active: true,
      },
      {
        referenceName: "Grace Jones",
        personaId: "persona-sable",
        username: "ai_sable",
        active: false,
      },
    ]);
    const recordPublicCandidateResults = vi.fn(async () => undefined);
    const advancePublicRuntimeCursor = vi.fn(async () => undefined);
    const executeCandidates = vi.fn(
      async (input: {
        kind?: "notification" | "public" | "manual";
        candidates: Array<{
          candidateIndex: number;
          personaId: string;
          payload: Record<string, unknown>;
        }>;
      }) => {
        expect(input.kind).toBe("public");
        expect(input.candidates).toHaveLength(2);
        expect(input.candidates.map((candidate) => candidate.personaId)).toEqual([
          "persona-marlowe",
          "persona-halo",
        ]);
        expect(input.candidates[0]?.payload).toMatchObject({
          boardId: "board-1",
          postId: "post-1",
          contentType: "post",
        });

        return {
          mode: "executed" as const,
          kind: "public" as const,
          message: "public pipeline executed",
          injectionPreview: {
            rpcName: "inject_persona_tasks",
            summary: {
              candidateCount: 2,
              insertedCount: 2,
              skippedCount: 0,
              insertedTaskIds: ["task-public-1", "task-public-2"],
              skippedReasonCounts: {},
            },
            results: input.candidates.map((candidate, index) => ({
              candidateIndex: candidate.candidateIndex,
              inserted: true,
              skipReason: null,
              taskId: `task-public-${index + 1}`,
              taskType: "post",
              dispatchKind: "public",
              personaUsername: candidate.personaId,
              sourceTable: "posts",
              sourceId: "post-1",
            })),
          },
          insertedTasks: [
            {
              id: "task-public-1",
              personaId: "persona-marlowe",
              status: "PENDING",
              errorMessage: null,
            } as never,
            {
              id: "task-public-2",
              personaId: "persona-halo",
              status: "PENDING",
              errorMessage: null,
            } as never,
          ],
        };
      },
    );
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities,
        listRuntimeOpportunityCycleRows,
        updateOpportunityProbabilities,
        scoreOpportunityProbabilities,
        listSelectedNotificationOpportunities: async () => [],
        listEligiblePublicCandidateOpportunities,
        listResolvedPersonaIdsByOpportunityIds,
        selectPublicSpeakerCandidates,
        resolveSpeakerPersonas,
        executeCandidates,
        recordPublicCandidateResults,
        markNotificationsProcessed: async () => undefined,
        loadPublicRuntimeCursor,
        loadReferenceBatch,
        advancePublicRuntimeCursor,
      },
    });

    await expect(service.executeFlow({ kind: "public" })).resolves.toMatchObject({
      kind: "public",
      insertedTasks: [{ id: "task-public-1" }, { id: "task-public-2" }],
    });

    expect(ingestOpportunities).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "public",
          sourceTable: "comments",
          sourceId: "comment-1",
          postId: "post-1",
          boardId: "board-1",
        }),
        expect.objectContaining({
          kind: "public",
          sourceTable: "posts",
          sourceId: "post-1",
          boardId: "board-1",
          postId: "post-1",
        }),
      ]),
    );
    expect(updateOpportunityProbabilities).toHaveBeenCalledWith([
      {
        opportunityId: "opp-public-1",
        probability: 0.74,
        probabilityModelKey: "mock:opportunities",
        probabilityPromptVersion: "runtime-opportunities-v2",
        evaluatedAt: "2026-04-03T10:00:00.000Z",
      },
    ]);
    expect(loadPublicRuntimeCursor).toHaveBeenCalledTimes(1);
    expect(loadReferenceBatch).toHaveBeenCalledWith({
      requestedGroupIndex: 2,
      batchSize: 10,
    });
    expect(listEligiblePublicCandidateOpportunities).toHaveBeenCalledWith({
      candidateEpoch: 0,
      groupIndex: 0,
      batchSize: 10,
      cycleLimit: 100,
      publicPersonaLimit: 3,
    });
    expect(listResolvedPersonaIdsByOpportunityIds).toHaveBeenCalledWith(["opp-public-1"]);
    expect(selectPublicSpeakerCandidates).toHaveBeenCalledWith({
      rows: [
        expect.objectContaining({
          id: "opp-public-1",
          selected: true,
        }),
      ],
      referenceBatch: ["David Bowie", "Laurie Anderson", "Grace Jones"],
    });
    expect(recordPublicCandidateResults).toHaveBeenCalledWith({
      groups: [
        {
          oppId: "opp-public-1",
          candidateEpoch: 0,
          groupIndex: 0,
          batchSize: 10,
          selectedSpeakers: [
            { name: "David Bowie", probability: 0.91 },
            { name: "Laurie Anderson", probability: 0.73 },
            { name: "Grace Jones", probability: 0.58 },
          ],
          resolvedPersonaIds: ["persona-marlowe", "persona-halo"],
        },
      ],
      matchedPersonaCounts: [
        {
          opportunityId: "opp-public-1",
          matchedPersonaCount: 3,
        },
      ],
    });
    expect(advancePublicRuntimeCursor).toHaveBeenCalledTimes(1);
  });

  it("falls back to one available active persona when the candidates LLM returns no speakers", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const selectPublicSpeakerCandidates = vi.fn(async () => [
      {
        oppId: "opp-public-1",
        selectedSpeakers: [],
      },
    ]);
    const resolveSpeakerPersonas = vi.fn(async (referenceNames: string[]) =>
      referenceNames.flatMap((referenceName) => {
        if (referenceName === "Grace Jones") {
          return [
            {
              referenceName,
              personaId: "persona-sable",
              username: "ai_sable",
              active: false,
            },
          ];
        }

        return [
          {
            referenceName,
            personaId: referenceName === "David Bowie" ? "persona-marlowe" : "persona-halo",
            username: referenceName === "David Bowie" ? "ai_marlowe" : "ai_halo",
            active: true,
          },
        ];
      }),
    );
    const recordPublicCandidateResults = vi.fn(async () => undefined);
    const executeCandidates = vi.fn(
      async (input: { candidates: Array<{ candidateIndex: number; personaId: string }> }) => {
        expect(input.candidates).toHaveLength(1);
        expect(["persona-marlowe", "persona-halo"]).toContain(input.candidates[0]?.personaId);
        return {
          mode: "executed" as const,
          kind: "public" as const,
          message: "public pipeline executed",
          injectionPreview: {
            rpcName: "inject_persona_tasks",
            summary: {
              candidateCount: 1,
              insertedCount: 1,
              skippedCount: 0,
              insertedTaskIds: ["task-1"],
              skippedReasonCounts: {},
            },
            results: [
              {
                candidateIndex: input.candidates[0]!.candidateIndex,
                inserted: true,
                skipReason: null,
                taskId: "task-1",
                taskType: "post",
                dispatchKind: "public",
                personaUsername: input.candidates[0]!.personaId,
                sourceTable: "posts",
                sourceId: "post-1",
              },
            ],
          },
          insertedTasks: [
            {
              id: "task-1",
              personaId: input.candidates[0]!.personaId,
              status: "PENDING",
              errorMessage: null,
            } as never,
          ],
        };
      },
    );
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 1,
        listRuntimeOpportunityCycleRows: async () => [],
        updateOpportunityProbabilities: async () => undefined,
        scoreOpportunityProbabilities: async () => [],
        listSelectedNotificationOpportunities: async () => [],
        loadPublicRuntimeCursor: async () => ({
          groupIndex: 0,
          candidateEpoch: 0,
        }),
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie", "Laurie Anderson", "Grace Jones"],
          totalReferences: 3,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        listEligiblePublicCandidateOpportunities: async () => [
          buildOpp({
            id: "opp-public-1",
            kind: "public",
            source_table: "posts",
            source_id: "post-1",
            board_id: "board-1",
            post_id: "post-1",
            notification_id: null,
            recipient_persona_id: null,
            content_type: "post",
            summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
            probability: 0.81,
            selected: true,
            matched_persona_count: 0,
            notification_context: null,
            notification_type: null,
          }),
        ],
        listResolvedPersonaIdsByOpportunityIds: async () => ({
          "opp-public-1": [],
        }),
        selectPublicSpeakerCandidates,
        resolveSpeakerPersonas,
        executeCandidates,
        recordPublicCandidateResults,
        advancePublicRuntimeCursor: async () => undefined,
        random: () => 0.75,
      },
    });

    await expect(service.executeFlow({ kind: "public" })).resolves.toMatchObject({
      kind: "public",
    });

    expect(selectPublicSpeakerCandidates).toHaveBeenCalledTimes(1);
    expect(resolveSpeakerPersonas).toHaveBeenCalledWith([
      "David Bowie",
      "Laurie Anderson",
      "Grace Jones",
    ]);
    expect(recordPublicCandidateResults).toHaveBeenCalledWith({
      groups: [
        {
          oppId: "opp-public-1",
          candidateEpoch: 0,
          groupIndex: 0,
          batchSize: 10,
          selectedSpeakers: [],
          resolvedPersonaIds: ["persona-halo"],
        },
      ],
      matchedPersonaCounts: [
        {
          opportunityId: "opp-public-1",
          matchedPersonaCount: 1,
        },
      ],
    });
  });

  it("falls back to one available active persona when llm-selected speakers resolve only to unusable personas", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const executeCandidates = vi.fn(async (input: { candidates: Array<{ personaId: string }> }) => {
      expect(input.candidates).toHaveLength(1);
      expect(input.candidates[0]?.personaId).toBe("persona-halo");
      return {
        mode: "executed" as const,
        kind: "public" as const,
        message: "public pipeline executed",
        injectionPreview: {
          rpcName: "inject_persona_tasks",
          summary: {
            candidateCount: 1,
            insertedCount: 1,
            skippedCount: 0,
            insertedTaskIds: ["task-1"],
            skippedReasonCounts: {},
          },
          results: [
            {
              candidateIndex: 0,
              inserted: true,
              skipReason: null,
              taskId: "task-1",
              taskType: "comment",
              dispatchKind: "public",
              personaUsername: "persona-halo",
              sourceTable: "comments",
              sourceId: "comment-1",
            },
          ],
        },
        insertedTasks: [
          {
            id: "task-1",
            personaId: "persona-halo",
            status: "PENDING",
            errorMessage: null,
          } as never,
        ],
      };
    });
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 1,
        listRuntimeOpportunityCycleRows: async () => [],
        updateOpportunityProbabilities: async () => undefined,
        scoreOpportunityProbabilities: async () => [],
        listSelectedNotificationOpportunities: async () => [],
        loadPublicRuntimeCursor: async () => ({
          groupIndex: 0,
          candidateEpoch: 0,
        }),
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie", "Laurie Anderson"],
          totalReferences: 2,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        listEligiblePublicCandidateOpportunities: async () => [
          buildOpp({
            id: "opp-public-1",
            kind: "public",
            source_table: "comments",
            source_id: "comment-1",
            board_id: "board-1",
            post_id: "post-1",
            comment_id: "comment-1",
            notification_id: null,
            recipient_persona_id: null,
            content_type: "comment",
            summary: "Board: Creative Lab | Recent comment: This still needs a real answer",
            probability: 0.91,
            selected: true,
            matched_persona_count: 1,
            notification_context: null,
            notification_type: null,
          }),
        ],
        listResolvedPersonaIdsByOpportunityIds: async () => ({
          "opp-public-1": ["persona-marlowe"],
        }),
        selectPublicSpeakerCandidates: async () => [
          {
            oppId: "opp-public-1",
            selectedSpeakers: [{ name: "David Bowie", probability: 0.88 }],
          },
        ],
        resolveSpeakerPersonas: async () => [
          {
            referenceName: "David Bowie",
            personaId: "persona-marlowe",
            username: "ai_marlowe",
            active: true,
          },
          {
            referenceName: "Laurie Anderson",
            personaId: "persona-halo",
            username: "ai_halo",
            active: true,
          },
        ],
        executeCandidates,
        recordPublicCandidateResults: async () => undefined,
        advancePublicRuntimeCursor: async () => undefined,
        random: () => 0.99,
      },
    });

    await expect(service.executeFlow({ kind: "public" })).resolves.toMatchObject({
      kind: "public",
    });
  });

  it("persists each 10-opportunity candidates batch immediately so earlier public matches survive later failures", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const eligibleRows = Array.from({ length: 12 }, (_, index) =>
      buildOpp({
        id: `opp-public-${index + 1}`,
        kind: "public",
        source_table: "posts",
        source_id: `post-${index + 1}`,
        board_id: "board-1",
        post_id: `post-${index + 1}`,
        notification_id: null,
        recipient_persona_id: null,
        content_type: "post",
        summary: `Board: Creative Lab | Recent post title: Candidate ${index + 1}`,
        probability: 0.91,
        selected: true,
        matched_persona_count: 0,
        notification_context: null,
        notification_type: null,
      }),
    );
    const recordPublicCandidateResults = vi.fn(async () => undefined);
    const executeCandidates = vi
      .fn<
        (input: {
          kind?: "notification" | "public" | "manual";
          candidates: Array<{ opportunityKey: string; personaId: string }>;
        }) => Promise<AiAgentOpportunityPipelineExecutedResponse>
      >()
      .mockImplementationOnce(async (input) => {
        expect(input.candidates).toHaveLength(10);
        return {
          mode: "executed",
          kind: "public",
          message: "first batch inserted",
          injectionPreview: {
            rpcName: "inject_persona_tasks",
            summary: {
              candidateCount: 10,
              insertedCount: 10,
              skippedCount: 0,
              insertedTaskIds: Array.from({ length: 10 }, (_, index) => `task-${index + 1}`),
              skippedReasonCounts: {},
            },
            results: input.candidates.map((candidate, index) => ({
              candidateIndex: index,
              inserted: true,
              skipReason: null,
              taskId: `task-${index + 1}`,
              taskType: "post",
              dispatchKind: "public",
              personaUsername: `persona-${candidate.personaId}`,
              sourceTable: "posts",
              sourceId: candidate.opportunityKey,
            })),
          },
          insertedTasks: [] as never[],
        };
      })
      .mockImplementationOnce(async () => {
        throw new Error("second candidate batch failed");
      });
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 12,
        listRuntimeOpportunityCycleRows: async () => [],
        updateOpportunityProbabilities: async () => undefined,
        scoreOpportunityProbabilities: async () => [],
        listSelectedNotificationOpportunities: async () => [],
        loadPublicRuntimeCursor: async () => ({
          groupIndex: 0,
          candidateEpoch: 0,
        }),
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie"],
          totalReferences: 1,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        listEligiblePublicCandidateOpportunities: async () => eligibleRows,
        listResolvedPersonaIdsByOpportunityIds: async (opportunityIds) =>
          Object.fromEntries(opportunityIds.map((opportunityId) => [opportunityId, []])),
        selectPublicSpeakerCandidates: async ({ rows }) =>
          rows.map((row) => ({
            oppId: row.id,
            selectedSpeakers: [{ name: "David Bowie", probability: 0.9 }],
          })),
        resolveSpeakerPersonas: async () => [
          {
            referenceName: "David Bowie",
            personaId: "persona-marlowe",
            username: "ai_marlowe",
            active: true,
          },
        ],
        executeCandidates,
        recordPublicCandidateResults,
        markNotificationsProcessed: async () => undefined,
        advancePublicRuntimeCursor: async () => undefined,
        random: () => 0,
      },
    });

    await expect(service.executeFlow({ kind: "public" })).rejects.toThrow(
      "second candidate batch failed",
    );

    expect(recordPublicCandidateResults).toHaveBeenCalledTimes(1);
    const recordCalls = recordPublicCandidateResults.mock.calls as unknown as Array<
      [{ groups: Array<unknown> }]
    >;
    const firstRecordInput = recordCalls[0]?.[0];
    expect(firstRecordInput.groups).toHaveLength(10);
    expect(executeCandidates).toHaveBeenCalledTimes(2);
  });

  it("emits structured stage events for public terminal logging", async () => {
    const runtimePreviewSet = buildMockIntakeRuntimePreviews();
    const events: AiAgentOpportunityPipelineEvent[] = [];
    const service = new AiAgentOpportunityPipelineService({
      onEvent: (event) => events.push(event),
      deps: {
        loadRuntimePreviewSet: async () => runtimePreviewSet,
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        ingestOpportunities: async () => 2,
        listRuntimeOpportunityCycleRows: async () => [
          buildOpp({
            id: "opp-public-1",
            kind: "public",
            source_table: "posts",
            source_id: "post-1",
            board_id: "board-1",
            post_id: "post-1",
            notification_id: null,
            recipient_persona_id: null,
            content_type: "post",
            summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
            source_created_at: "2026-03-29T01:03:00.000Z",
          }),
        ],
        scoreOpportunityProbabilities: async () => [
          {
            opportunityId: "opp-public-1",
            probability: 0.74,
            probabilityModelKey: "mock:opportunities",
            probabilityPromptVersion: "runtime-opportunities-v2",
            evaluatedAt: "2026-04-03T10:00:00.000Z",
          },
        ],
        updateOpportunityProbabilities: async () => undefined,
        listSelectedNotificationOpportunities: async () => [],
        loadPublicRuntimeCursor: async () => ({
          groupIndex: 2,
          candidateEpoch: 7,
        }),
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie", "Laurie Anderson"],
          totalReferences: 2,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        listEligiblePublicCandidateOpportunities: async () => [
          buildOpp({
            id: "opp-public-1",
            kind: "public",
            source_table: "posts",
            source_id: "post-1",
            board_id: "board-1",
            post_id: "post-1",
            notification_id: null,
            recipient_persona_id: null,
            content_type: "post",
            summary: "Board: Creative Lab | Recent post title: Best prompting workflows this week",
            probability: 0.81,
            selected: true,
            matched_persona_count: 1,
            notification_context: null,
            notification_type: null,
            source_created_at: "2026-03-29T01:03:00.000Z",
          }),
        ],
        listResolvedPersonaIdsByOpportunityIds: async () => ({
          "opp-public-1": ["persona-orchid"],
        }),
        selectPublicSpeakerCandidates: async () => [
          {
            oppId: "opp-public-1",
            selectedSpeakers: [{ name: "David Bowie", probability: 0.91 }],
          },
        ],
        resolveSpeakerPersonas: async () => [
          {
            referenceName: "David Bowie",
            personaId: "persona-marlowe",
            username: "ai_marlowe",
            active: true,
          },
        ],
        executeCandidates: async (input) => ({
          mode: "executed",
          kind: "public",
          message: "public pipeline executed",
          injectionPreview: {
            rpcName: "inject_persona_tasks",
            summary: {
              candidateCount: input.candidates.length,
              insertedCount: 1,
              skippedCount: 0,
              insertedTaskIds: ["task-public-1"],
              skippedReasonCounts: {},
            },
            results: [
              {
                candidateIndex: 0,
                inserted: true,
                skipReason: null,
                taskId: "task-public-1",
                taskType: "post",
                dispatchKind: "public",
                personaUsername: "ai_marlowe",
                sourceTable: "posts",
                sourceId: "post-1",
              },
            ],
          },
          insertedTasks: [
            {
              id: "task-public-1",
              personaId: "persona-marlowe",
              status: "PENDING",
              errorMessage: null,
            } as never,
          ],
        }),
        recordPublicCandidateResults: async () => undefined,
        markNotificationsProcessed: async () => undefined,
        advancePublicRuntimeCursor: async () => undefined,
      },
    });

    await service.executeFlow({ kind: "public" });

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "snapshot_loaded",
          kind: "public",
        }),
        expect.objectContaining({
          type: "opportunity_ingest_completed",
          kind: "public",
          ingestedCount: 2,
        }),
        expect.objectContaining({
          type: "opportunity_scoring_batch_started",
          kind: "public",
          batchIndex: 1,
          batchCount: 1,
          rowCount: 1,
        }),
        expect.objectContaining({
          type: "opportunity_scoring_batch_completed",
          kind: "public",
          selectedCount: 1,
          rejectedCount: 0,
        }),
        expect.objectContaining({
          type: "public_candidate_scope_loaded",
          candidateEpoch: 7,
          requestedGroupIndex: 2,
          effectiveGroupIndex: 0,
          eligibleCount: 1,
        }),
        expect.objectContaining({
          type: "public_candidate_batch_completed",
          kind: "public",
          candidateCount: 1,
          insertedCount: 1,
          skippedCount: 0,
        }),
      ]),
    );
  });

  it("returns explicit task outcomes for admin public candidate batches", async () => {
    const eligibleRow = buildOpp({
      id: "opp-public-1",
      kind: "public",
      source_table: "posts",
      source_id: "post-1",
      notification_id: null,
      recipient_persona_id: null,
      content_type: "post",
      probability: 0.82,
      selected: true,
      notification_context: null,
      notification_type: null,
    });
    const service = new AiAgentOpportunityPipelineService({
      deps: {
        loadRuntimeConfig: async () => buildRuntimeConfig(),
        listOpportunitiesByIds: async () => [eligibleRow],
        loadReferenceBatch: async () => ({
          referenceNames: ["David Bowie"],
          totalReferences: 1,
          effectiveGroupIndex: 0,
          batchSize: 10,
        }),
        listResolvedPersonaIdsByOpportunityIds: async () => ({
          "opp-public-1": [],
        }),
        selectPublicSpeakerCandidates: async () => [
          {
            oppId: "opp-public-1",
            selectedSpeakers: [{ name: "David Bowie", probability: 0.88 }],
          },
        ],
        resolveSpeakerPersonas: async () => [
          {
            referenceName: "David Bowie",
            personaId: "persona-marlowe",
            username: "ai_marlowe",
            active: true,
          },
        ],
        recordPublicCandidateResults: async () => undefined,
        executeCandidates: async () => ({
          mode: "executed",
          kind: "public",
          message: "Inserted 1 persona_tasks rows for public intake.",
          injectionPreview: {
            rpcName: "inject_persona_tasks",
            summary: {
              candidateCount: 1,
              insertedCount: 1,
              skippedCount: 0,
              insertedTaskIds: ["task-1"],
              skippedReasonCounts: {},
            },
            results: [
              {
                candidateIndex: 0,
                inserted: true,
                skipReason: null,
                taskId: "task-1",
                taskType: "post",
                dispatchKind: "public",
                personaUsername: "ai_marlowe",
                sourceTable: "posts",
                sourceId: "post-1",
              },
            ],
          },
          insertedTasks: [
            {
              id: "task-1",
              personaId: "persona-marlowe",
              status: "PENDING",
              errorMessage: null,
            } as never,
          ],
        }),
        random: () => 0,
      },
    });

    await expect(
      service.executeAdminPublicCandidateBatch({
        opportunityIds: ["opp-public-1"],
        groupIndex: 0,
        batchSize: 10,
      }),
    ).resolves.toMatchObject({
      resolvedRows: [
        {
          opportunityId: "opp-public-1",
          referenceName: "David Bowie",
          personaId: "persona-marlowe",
          probability: 0.88,
          active: true,
        },
      ],
      taskOutcomes: [
        {
          opportunityId: "opp-public-1",
          personaId: "persona-marlowe",
          inserted: true,
          taskId: "task-1",
          status: "PENDING",
        },
      ],
    });
  });
});
