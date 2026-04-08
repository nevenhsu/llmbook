import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMockAiAgentOverviewSnapshot } from "@/lib/ai/agent/testing/mock-overview-snapshot";
import { InMemoryTaskEventSink } from "@/lib/ai/observability/task-events";
import { InMemoryTaskQueueStore, TaskQueue, type QueueTask } from "@/lib/ai/task-queue/task-queue";
import { AiAgentTextLaneService } from "@/lib/ai/agent/execution/text-lane-service";

function buildQueueTask(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    taskType: overrides.taskType ?? "reply",
    payload: overrides.payload ?? {},
    status: overrides.status ?? "PENDING",
    scheduledAt: overrides.scheduledAt ?? new Date("2026-03-30T00:00:00.000Z"),
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    resultId: overrides.resultId,
    resultType: overrides.resultType,
    errorMessage: overrides.errorMessage,
    leaseOwner: overrides.leaseOwner,
    leaseUntil: overrides.leaseUntil,
    createdAt: overrides.createdAt ?? new Date("2026-03-30T00:00:00.000Z"),
  };
}

describe("AiAgentTextLaneService", () => {
  it("returns idle when no queued text task is available", async () => {
    const sink = new InMemoryTaskEventSink();
    const service = new AiAgentTextLaneService({
      deps: {
        queue: new TaskQueue({
          store: new InMemoryTaskQueueStore(),
          eventSink: sink,
          leaseMs: 30_000,
        }),
        eventSink: sink,
        executeTextTarget: vi.fn(),
        queueMediaForTask: vi.fn(async () => null),
        beginTaskHeartbeat: () => vi.fn(),
        now: () => new Date("2026-03-30T01:00:00.000Z"),
      },
    });

    await expect(
      service.runNext({
        workerId: "text-worker:test",
        heartbeatMs: 15_000,
      }),
    ).resolves.toMatchObject({
      mode: "idle",
      recoveredTimedOut: 0,
    });
  });

  it("claims the next queued task and records a completion event after shared text execution", async () => {
    const sink = new InMemoryTaskEventSink();
    const store = new InMemoryTaskQueueStore([
      buildQueueTask({ id: "post-task", taskType: "post" }),
      buildQueueTask({ id: "reply-task", taskType: "reply" }),
    ]);
    const queue = new TaskQueue({
      store,
      eventSink: sink,
      leaseMs: 30_000,
    });
    const updatedTask = {
      ...buildMockAiAgentOverviewSnapshot().recentTasks[0],
      id: "reply-task",
      status: "DONE" as const,
      resultId: "comment-new-1",
      resultType: "comment" as const,
      completedAt: "2026-03-30T01:00:10.000Z",
    };
    const beginTaskHeartbeat = vi.fn(() => vi.fn());

    const service = new AiAgentTextLaneService({
      deps: {
        queue,
        eventSink: sink,
        executeTextTarget: async (taskId) => ({
          mode: "executed",
          target: "text_once",
          targetLabel: "Run next text task",
          selectedTaskId: taskId,
          summary: `Persisted comment comment-new-1 and completed queue task ${taskId}.`,
          executionPreview: null,
          compressionResult: null,
          textResult: {
            taskId,
            persistedTable: "comments",
            persistedId: "comment-new-1",
            resultType: "comment",
            writeMode: "inserted",
            historyId: null,
            updatedTask,
          },
          mediaResult: null,
          orchestratorResult: null,
        }),
        queueMediaForTask: vi.fn(async () => ({
          taskId: "reply-task",
          mediaId: "media-queued-1",
          ownerTable: "comments" as const,
          ownerId: "comment-new-1",
          status: "PENDING_GENERATION" as const,
          imagePrompt: "queued media",
          imageAlt: null,
          url: null,
          mimeType: null,
          width: null,
          height: null,
          sizeBytes: null,
          retryCount: 0,
          maxRetries: 3,
          nextRetryAt: null,
          lastError: null,
        })),
        beginTaskHeartbeat,
        now: () => new Date("2026-03-30T01:00:00.000Z"),
      },
    });

    await expect(
      service.runNext({
        workerId: "text-worker:test",
        heartbeatMs: 15_000,
      }),
    ).resolves.toMatchObject({
      mode: "executed",
      claimedTaskId: "reply-task",
    });

    expect(beginTaskHeartbeat).toHaveBeenCalledWith({
      claimedTask: expect.objectContaining({
        id: "reply-task",
        taskType: "reply",
      }),
      workerId: "text-worker:test",
      heartbeatMs: 15_000,
    });
    expect(sink.events.some((event) => event.reasonCode === "COMPLETED")).toBe(true);
  });

  it("fails the claimed task when shared text execution returns guarded_execute", async () => {
    const sink = new InMemoryTaskEventSink();
    const store = new InMemoryTaskQueueStore([
      buildQueueTask({ id: "reply-task", taskType: "reply" }),
    ]);
    const queue = new TaskQueue({
      store,
      eventSink: sink,
      leaseMs: 30_000,
    });

    const service = new AiAgentTextLaneService({
      deps: {
        queue,
        eventSink: sink,
        executeTextTarget: async (taskId) => ({
          mode: "guarded_execute",
          target: "text_once",
          targetLabel: "Run next text task",
          blocker: "notification_text_execution_not_implemented",
          selectedTaskId: taskId,
          summary:
            "Live text execution currently requires canonical notification target ids for notification-backed tasks.",
          executionPreview: null,
        }),
        queueMediaForTask: vi.fn(async () => null),
        beginTaskHeartbeat: () => vi.fn(),
        now: () => new Date("2026-03-30T01:00:00.000Z"),
      },
    });

    await expect(
      service.runNext({
        workerId: "text-worker:test",
        heartbeatMs: 15_000,
      }),
    ).resolves.toMatchObject({
      mode: "failed",
      claimedTaskId: "reply-task",
    });

    expect(store.snapshot()[0]?.status).toBe("PENDING");
  });
});
