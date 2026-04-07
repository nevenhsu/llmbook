import { describe, expect, it } from "vitest";
import { buildOperatorFlowTrace } from "@/lib/ai/agent/operator-flow-trace";

describe("operator-flow-trace", () => {
  it("builds an end-to-end operator trace across intake, execution, and memory stages", () => {
    const trace = buildOperatorFlowTrace({
      injectionResponse: {
        mode: "executed",
        kind: "notification",
        message: "Inserted 1 persona_tasks rows for notification intake.",
        injectionPreview: {} as never,
        insertedTasks: [
          {
            id: "task-1",
            personaId: "persona-1",
            personaUsername: "ai_orchid",
            personaDisplayName: "Orchid",
            taskType: "comment",
            dispatchKind: "notification",
            sourceTable: "notifications",
            sourceId: "notification-1",
            dedupeKey: null,
            cooldownUntil: null,
            payload: {},
            status: "PENDING",
            scheduledAt: "2026-03-30T00:00:00.000Z",
            startedAt: null,
            completedAt: null,
            retryCount: 0,
            maxRetries: 3,
            leaseOwner: null,
            leaseUntil: null,
            resultId: null,
            resultType: null,
            errorMessage: null,
            createdAt: "2026-03-30T00:00:00.000Z",
          },
        ],
      },
      runnerResponse: {
        mode: "executed",
        target: "text_once",
        targetLabel: "Run next text task",
        selectedTaskId: "task-1",
        summary: "Persisted comment.",
        executionPreview: null,
        compressionResult: null,
        textResult: {
          taskId: "task-1",
          persistedTable: "comments",
          persistedId: "comment-1",
          resultType: "comment",
          updatedTask: {} as never,
        },
        mediaResult: null,
        orchestratorResult: null,
      },
      memoryOutcomeTrace: {
        selectedTaskId: "task-1",
        selectedTaskPersonaId: "persona-1",
        latestWriteCandidateTaskId: "task-1",
        latestWriteCandidatePath: "deterministic_comment",
        latestWritePersistedMemoryId: "memory-write-1",
        latestWritePersistedTaskId: "task-1",
        compressionPersistedLongMemoryId: "long-memory-1",
        compressionPersonaId: "persona-1",
        stageStatus: {
          taskSelected: true,
          latestWriteCandidateReady: true,
          latestWritePersisted: true,
          compressionPersisted: true,
        },
        allStagesSharePersona: true,
        latestWriteCandidateMatchesSelectedTask: true,
        latestWritePersistMatchesSelectedTask: true,
      },
    });

    expect(trace).toMatchObject({
      intake: {
        kind: "notification",
        insertedTaskCount: 1,
        insertedTaskIds: ["task-1"],
        completed: true,
      },
      execution: {
        mode: "executed",
        target: "text_once",
        selectedTaskId: "task-1",
        textPersisted: true,
        mediaPersisted: false,
        compressionPersisted: false,
      },
      stageStatus: {
        intakeCompleted: true,
        executionCompleted: true,
        latestWriteReady: true,
        latestWritePersisted: true,
        compressionPersisted: true,
      },
    });
  });
});
