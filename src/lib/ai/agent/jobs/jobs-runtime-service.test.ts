import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AiAgentJobsRuntimeService } from "@/lib/ai/agent/jobs/jobs-runtime-service";
import { AiAgentJobPermanentSkipError } from "@/lib/ai/agent/execution/persona-task-generator";
import type { AiAgentJobRuntimeStateSnapshot, AiAgentJobTask } from "@/lib/ai/agent/jobs/job-types";

function buildRuntimeStateSnapshot(
  overrides: Partial<AiAgentJobRuntimeStateSnapshot> = {},
): AiAgentJobRuntimeStateSnapshot {
  return {
    runtimeKey: "local",
    paused: false,
    leaseOwner: null,
    leaseUntil: null,
    runtimeAppSeenAt: "2026-04-08T00:00:00.000Z",
    lastStartedAt: null,
    lastFinishedAt: null,
    updatedAt: "2026-04-08T00:00:00.000Z",
    statusLabel: "Idle",
    detail: "idle",
    ...overrides,
  };
}

function buildJobTask(overrides: Partial<AiAgentJobTask> = {}): AiAgentJobTask {
  return {
    id: overrides.id ?? "job-1",
    runtimeKey: overrides.runtimeKey ?? "local",
    jobType: overrides.jobType ?? "memory_compress",
    subjectKind: overrides.subjectKind ?? "persona",
    subjectId: overrides.subjectId ?? "persona-1",
    dedupeKey: overrides.dedupeKey ?? "memory_compress:persona-1",
    status: overrides.status ?? "RUNNING",
    payload: overrides.payload ?? { persona_id: "persona-1" },
    requestedBy: overrides.requestedBy ?? "admin-1",
    scheduledAt: overrides.scheduledAt ?? new Date("2026-04-08T00:00:00.000Z"),
    startedAt: overrides.startedAt ?? new Date("2026-04-08T00:00:05.000Z"),
    completedAt: overrides.completedAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? "jobs-runtime:test",
    leaseUntil: overrides.leaseUntil ?? new Date("2026-04-08T00:01:05.000Z"),
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-04-08T00:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-04-08T00:00:05.000Z"),
  };
}

describe("AiAgentJobsRuntimeService", () => {
  it("executes memory_compress jobs and completes the claimed row", async () => {
    const touchRuntimeAppHeartbeat = vi.fn(async () => buildRuntimeStateSnapshot());
    const claimLease = vi.fn(async () => ({
      mode: "claimed" as const,
      summary: "claimed",
      runtimeState: buildRuntimeStateSnapshot({
        statusLabel: "Running",
        leaseOwner: "jobs-runtime:test",
      }),
    }));
    const releaseLease = vi.fn(async () => ({
      mode: "released" as const,
      summary: "released",
      runtimeState: buildRuntimeStateSnapshot(),
    }));
    const recoverTimedOut = vi.fn(async () => []);
    const claimOldestPending = vi.fn(async () =>
      buildJobTask({
        status: "RUNNING",
        jobType: "memory_compress",
        subjectKind: "persona",
        subjectId: "persona-9",
      }),
    );
    const completeTask = vi.fn(async () =>
      buildJobTask({
        status: "DONE",
        jobType: "memory_compress",
        subjectKind: "persona",
        subjectId: "persona-9",
      }),
    );
    const executeMemoryCompress = vi.fn(async () => ({
      mode: "persisted" as const,
      personaId: "persona-9",
      summary: "done",
      compressionPreview: {} as any,
      persistedLongMemoryId: "memory-long-1",
      deletedShortMemoryIds: [],
      protectedShortMemoryIds: [],
      verificationTrace: {
        persistedLongMemoryId: "memory-long-1",
        persistedLongMemory: null,
        cleanup: {
          deletedShortMemoryIds: [],
          protectedShortMemoryIds: [],
        },
      },
      preview: {} as any,
    }));

    const service = new AiAgentJobsRuntimeService({
      deps: {
        runtimeState: {
          runtimeKey: "local",
          touchRuntimeAppHeartbeat,
          claimLease,
          releaseLease,
        } as any,
        taskStore: {
          recoverTimedOut,
          claimOldestPending,
          completeTask,
          failTask: vi.fn(),
          skipTask: vi.fn(),
          updateHeartbeat: vi.fn(),
          getById: vi.fn(),
        },
        executeMemoryCompress,
        beginLeaseHeartbeat: () => () => undefined,
      },
    });

    const result = await service.runNext({
      workerId: "jobs-runtime:test",
      heartbeatMs: 1_000,
    });

    expect(result.mode).toBe("executed");
    if (result.mode !== "executed") {
      throw new Error("expected executed result");
    }
    expect(result.jobType).toBe("memory_compress");
    expect(executeMemoryCompress).toHaveBeenCalledWith("persona-9");
    expect(completeTask).toHaveBeenCalled();
    expect(touchRuntimeAppHeartbeat).toHaveBeenCalledTimes(1);
  });

  it("persists completed persona_task targets for public and notification jobs through the shared text path", async () => {
    const completeTask = vi.fn(async () =>
      buildJobTask({
        status: "DONE",
        jobType: "public_task",
        subjectKind: "persona_task",
        subjectId: "task-3",
      }),
    );
    const executeTextTask = vi.fn(async () => ({
      taskId: "task-3",
      persistedTable: "comments" as const,
      persistedId: "comment-9",
      resultType: "comment" as const,
      writeMode: "overwritten" as const,
      historyId: "history-9",
      updatedTask: null as any,
    }));

    const service = new AiAgentJobsRuntimeService({
      deps: {
        runtimeState: {
          runtimeKey: "local",
          touchRuntimeAppHeartbeat: async () => buildRuntimeStateSnapshot(),
          claimLease: async () => ({
            mode: "claimed" as const,
            summary: "claimed",
            runtimeState: buildRuntimeStateSnapshot({ statusLabel: "Running" }),
          }),
          releaseLease: async () => ({
            mode: "released" as const,
            summary: "released",
            runtimeState: buildRuntimeStateSnapshot(),
          }),
        } as any,
        taskStore: {
          recoverTimedOut: async () => [],
          claimOldestPending: async () =>
            buildJobTask({
              jobType: "public_task",
              subjectKind: "persona_task",
              subjectId: "task-3",
            }),
          completeTask,
          failTask: vi.fn(),
          skipTask: vi.fn(),
          updateHeartbeat: vi.fn(),
          getById: vi.fn(),
        },
        executeTextTask,
        beginLeaseHeartbeat: () => () => undefined,
      },
    });

    const result = await service.runNext({
      workerId: "jobs-runtime:test",
      heartbeatMs: 1_000,
    });

    expect(result.mode).toBe("executed");
    if (result.mode !== "executed") {
      throw new Error("expected executed result");
    }
    expect(result.jobType).toBe("public_task");
    expect(result.summary).toBe("Overwrote comment comment-9 from persona_task task-3.");
    expect(executeTextTask).toHaveBeenCalledWith({
      jobTaskId: "job-1",
      taskId: "task-3",
      sourceRuntime: "jobs_runtime",
      createdBy: "admin-1",
    });
    expect(completeTask).toHaveBeenCalled();
  });

  it("can insert new persona_task output through jobs-runtime when no persisted target exists yet", async () => {
    const completeTask = vi.fn(async () =>
      buildJobTask({
        status: "DONE",
        jobType: "notification_task",
        subjectKind: "persona_task",
        subjectId: "task-4",
      }),
    );
    const executeTextTask = vi.fn(async () => ({
      taskId: "task-4",
      persistedTable: "comments" as const,
      persistedId: "comment-new-4",
      resultType: "comment" as const,
      writeMode: "inserted" as const,
      historyId: null,
      updatedTask: null as any,
    }));

    const service = new AiAgentJobsRuntimeService({
      deps: {
        runtimeState: {
          runtimeKey: "local",
          touchRuntimeAppHeartbeat: async () => buildRuntimeStateSnapshot(),
          claimLease: async () => ({
            mode: "claimed" as const,
            summary: "claimed",
            runtimeState: buildRuntimeStateSnapshot({ statusLabel: "Running" }),
          }),
          releaseLease: async () => ({
            mode: "released" as const,
            summary: "released",
            runtimeState: buildRuntimeStateSnapshot(),
          }),
        } as any,
        taskStore: {
          recoverTimedOut: async () => [],
          claimOldestPending: async () =>
            buildJobTask({
              jobType: "notification_task",
              subjectKind: "persona_task",
              subjectId: "task-4",
            }),
          completeTask,
          failTask: vi.fn(),
          skipTask: vi.fn(),
          updateHeartbeat: vi.fn(),
          getById: vi.fn(),
        },
        executeTextTask,
        beginLeaseHeartbeat: () => () => undefined,
      },
    });

    const result = await service.runNext({
      workerId: "jobs-runtime:test",
      heartbeatMs: 1_000,
    });

    expect(result.mode).toBe("executed");
    if (result.mode !== "executed") {
      throw new Error("expected executed result");
    }
    expect(result.jobType).toBe("notification_task");
    expect(result.summary).toBe("Persisted new comment comment-new-4 from persona_task task-4.");
    expect(executeTextTask).toHaveBeenCalledWith({
      jobTaskId: "job-1",
      taskId: "task-4",
      sourceRuntime: "jobs_runtime",
      createdBy: "admin-1",
    });
    expect(completeTask).toHaveBeenCalled();
  });

  it("skips text jobs when shared persona-task persistence is permanently blocked", async () => {
    const skipTask = vi.fn(async () =>
      buildJobTask({
        status: "SKIPPED",
        jobType: "notification_task",
        subjectKind: "persona_task",
        subjectId: "task-7",
      }),
    );

    const service = new AiAgentJobsRuntimeService({
      deps: {
        runtimeState: {
          runtimeKey: "local",
          touchRuntimeAppHeartbeat: async () => buildRuntimeStateSnapshot(),
          claimLease: async () => ({
            mode: "claimed" as const,
            summary: "claimed",
            runtimeState: buildRuntimeStateSnapshot({ statusLabel: "Running" }),
          }),
          releaseLease: async () => ({
            mode: "released" as const,
            summary: "released",
            runtimeState: buildRuntimeStateSnapshot(),
          }),
        } as any,
        taskStore: {
          recoverTimedOut: async () => [],
          claimOldestPending: async () =>
            buildJobTask({
              jobType: "notification_task",
              subjectKind: "persona_task",
              subjectId: "task-7",
            }),
          completeTask: vi.fn(),
          failTask: vi.fn(),
          skipTask,
          updateHeartbeat: vi.fn(),
          getById: vi.fn(),
        },
        executeTextTask: async () => {
          throw new AiAgentJobPermanentSkipError(
            "persona_task cannot be loaded for shared persistence",
          );
        },
        beginLeaseHeartbeat: () => () => undefined,
      },
    });

    const result = await service.runNext({
      workerId: "jobs-runtime:test",
      heartbeatMs: 1_000,
    });

    expect(result.mode).toBe("skipped");
    if (result.mode !== "skipped") {
      throw new Error("expected skipped result");
    }
    expect(result.jobType).toBe("notification_task");
    expect(result.summary).toContain("shared persistence");
    expect(skipTask).toHaveBeenCalled();
  });
});
