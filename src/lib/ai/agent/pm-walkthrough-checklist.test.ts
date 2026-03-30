import { describe, expect, it } from "vitest";
import { buildContinuousRuntimeCheckpoint } from "@/lib/ai/agent/continuous-runtime-checkpoint";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";
import { buildAiAgentReadinessSummary } from "@/lib/ai/agent/readiness-summary";
import { buildPmWalkthroughChecklist } from "@/lib/ai/agent/pm-walkthrough-checklist";

describe("buildPmWalkthroughChecklist", () => {
  it("returns ready when all walkthrough stages have concrete evidence", () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    snapshot.runtimeState = {
      available: true,
      statusLabel: "Running",
      detail: "Runtime lease is healthy.",
      paused: false,
      leaseOwner: "orchestrator-1",
      leaseUntil: "2026-03-29T01:15:00.000Z",
      cooldownUntil: null,
      lastStartedAt: "2026-03-29T01:10:00.000Z",
      lastFinishedAt: "2026-03-29T01:11:00.000Z",
    };
    snapshot.queue.running = 0;
    snapshot.queue.failed = 0;
    snapshot.queue.inReview = 0;

    const checkpoint = buildContinuousRuntimeCheckpoint({
      snapshot,
      readinessSummary: buildAiAgentReadinessSummary(snapshot),
      operatorFlowTrace: {
        intake: {
          kind: "public",
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
          compressionPersisted: true,
        },
        memory: {
          selectedTaskId: "task-1",
          selectedTaskPersonaId: "persona-1",
          latestWriteCandidateTaskId: "task-1",
          latestWriteCandidatePath: "deterministic_comment",
          latestWritePersistedMemoryId: "memory-1",
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
        stageStatus: {
          intakeCompleted: true,
          executionCompleted: true,
          latestWriteReady: true,
          latestWritePersisted: true,
          compressionPersisted: true,
        },
      },
    });

    const checklist = buildPmWalkthroughChecklist({
      snapshot,
      operatorFlowTrace: {
        intake: {
          kind: "public",
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
          compressionPersisted: true,
        },
        memory: {
          selectedTaskId: "task-1",
          selectedTaskPersonaId: "persona-1",
          latestWriteCandidateTaskId: "task-1",
          latestWriteCandidatePath: "deterministic_comment",
          latestWritePersistedMemoryId: "memory-1",
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
        stageStatus: {
          intakeCompleted: true,
          executionCompleted: true,
          latestWriteReady: true,
          latestWritePersisted: true,
          compressionPersisted: true,
        },
      },
      checkpoint,
    });

    expect(checklist).toMatchObject({
      overallStatus: "ready",
      statusLabel: "Walkthrough Ready For PM Sign-Off",
    });
  });
});
