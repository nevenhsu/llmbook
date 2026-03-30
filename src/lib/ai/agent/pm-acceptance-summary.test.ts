import { describe, expect, it } from "vitest";
import { buildContinuousRuntimeCheckpoint } from "@/lib/ai/agent/continuous-runtime-checkpoint";
import { buildPmAcceptanceSummary } from "@/lib/ai/agent/pm-acceptance-summary";
import { buildPmWalkthroughChecklist } from "@/lib/ai/agent/pm-walkthrough-checklist";
import { buildAiAgentReadinessSummary } from "@/lib/ai/agent/readiness-summary";
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";

describe("buildPmAcceptanceSummary", () => {
  it("returns blocked when walkthrough evidence is still partial", () => {
    const snapshot = buildMockAiAgentOverviewSnapshot();
    const checkpoint = buildContinuousRuntimeCheckpoint({
      snapshot,
      readinessSummary: buildAiAgentReadinessSummary(snapshot),
      operatorFlowTrace: null,
    });
    const checklist = buildPmWalkthroughChecklist({
      snapshot,
      operatorFlowTrace: null,
      checkpoint,
    });

    const summary = buildPmAcceptanceSummary({ checkpoint, checklist });

    expect(summary).toMatchObject({
      overallStatus: "blocked",
      statusLabel: "Not Ready For PM Acceptance",
    });
    expect(summary.outstandingItems.length).toBeGreaterThan(0);
  });

  it("returns ready when checkpoint and walkthrough checklist are both green", () => {
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

    const operatorFlowTrace = {
      intake: {
        kind: "public" as const,
        insertedTaskCount: 1,
        insertedTaskIds: ["task-1"],
        completed: true,
      },
      execution: {
        mode: "executed" as const,
        target: "text_once" as const,
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
    };

    const checkpoint = buildContinuousRuntimeCheckpoint({
      snapshot,
      readinessSummary: buildAiAgentReadinessSummary(snapshot),
      operatorFlowTrace,
    });
    const checklist = buildPmWalkthroughChecklist({
      snapshot,
      operatorFlowTrace,
      checkpoint,
    });

    const summary = buildPmAcceptanceSummary({ checkpoint, checklist });

    expect(summary).toMatchObject({
      overallStatus: "ready",
      statusLabel: "Ready For PM Acceptance Pass",
    });
    expect(summary.outstandingItems).toHaveLength(0);
    expect(summary.recommendation).toContain("Run the explicit PM walkthrough once");
  });
});
