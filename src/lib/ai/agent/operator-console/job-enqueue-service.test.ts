import { describe, expect, it, vi } from "vitest";
import type { AiAgentJobTask } from "@/lib/ai/agent/jobs/job-types";
import { AiAgentJobEnqueueService } from "@/lib/ai/agent/operator-console/job-enqueue-service";

function buildJobTask(overrides: Partial<AiAgentJobTask> = {}): AiAgentJobTask {
  const now = new Date("2026-04-08T12:00:00.000Z");
  return {
    id: overrides.id ?? "job-1",
    runtimeKey: overrides.runtimeKey ?? "global",
    jobType: overrides.jobType ?? "public_task",
    subjectKind: overrides.subjectKind ?? "persona_task",
    subjectId: overrides.subjectId ?? "task-1",
    dedupeKey: overrides.dedupeKey ?? "public_task:task-1",
    status: overrides.status ?? "PENDING",
    payload: overrides.payload ?? { persona_task_id: "task-1" },
    requestedBy: overrides.requestedBy ?? "admin-user",
    scheduledAt: overrides.scheduledAt ?? now,
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? null,
    leaseUntil: overrides.leaseUntil ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe("AiAgentJobEnqueueService", () => {
  it("returns the active row instead of inserting a duplicate job", async () => {
    const activeJob = buildJobTask();
    const findActiveByDedupeKey = vi.fn().mockResolvedValue(activeJob);
    const insertPendingTask = vi.fn();

    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey,
        insertPendingTask,
        loadPersonaTask: vi.fn().mockResolvedValue({
          id: "task-1",
          status: "DONE",
          taskType: "comment",
        }),
      },
    });

    const result = await service.enqueue({
      jobType: "public_task",
      subjectId: "task-1",
      requestedBy: "admin-user",
    });

    expect(result).toEqual({
      mode: "deduped",
      task: activeJob,
    });
    expect(insertPendingTask).not.toHaveBeenCalled();
  });

  it("enqueues a completed public persona task", async () => {
    const insertedJob = buildJobTask({
      id: "job-2",
      dedupeKey: "public_task:task-2",
      subjectId: "task-2",
      payload: { persona_task_id: "task-2" },
    });
    const insertPendingTask = vi.fn().mockResolvedValue(insertedJob);

    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn().mockResolvedValue(null),
        insertPendingTask,
        loadPersonaTask: vi.fn().mockResolvedValue({
          id: "task-2",
          status: "DONE",
          taskType: "post",
        }),
      },
    });

    const result = await service.enqueue({
      jobType: "public_task",
      subjectId: "task-2",
      requestedBy: "admin-user",
    });

    expect(result.mode).toBe("enqueued");
    expect(insertPendingTask).toHaveBeenCalledWith({
      runtimeKey: "global",
      jobType: "public_task",
      subjectKind: "persona_task",
      subjectId: "task-2",
      dedupeKey: "public_task:task-2",
      payload: { persona_task_id: "task-2" },
      requestedBy: "admin-user",
    });
  });

  it("rejects public or notification jobs when the persona task is not done", async () => {
    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn().mockResolvedValue(null),
        insertPendingTask: vi.fn(),
        loadPersonaTask: vi.fn().mockResolvedValue({
          id: "task-3",
          status: "FAILED",
          taskType: "comment",
        }),
      },
    });

    await expect(
      service.enqueue({
        jobType: "notification_task",
        subjectId: "task-3",
        requestedBy: "admin-user",
      }),
    ).rejects.toThrow("only completed persona_tasks can be queued");
  });

  it("rejects image jobs when the media row is not done", async () => {
    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn().mockResolvedValue(null),
        insertPendingTask: vi.fn(),
        loadMedia: vi.fn().mockResolvedValue({
          id: "media-1",
          status: "FAILED",
        }),
      },
    });

    await expect(
      service.enqueue({
        jobType: "image_generation",
        subjectId: "media-1",
        requestedBy: "admin-user",
      }),
    ).rejects.toThrow("only completed media rows can be queued");
  });

  it("clones a terminal job into a new pending row with the same payload", async () => {
    const sourceJob = buildJobTask({
      id: "job-failed",
      status: "FAILED",
      jobType: "notification_task",
      subjectKind: "persona_task",
      subjectId: "task-9",
      dedupeKey: "notification_task:task-9",
      payload: { persona_task_id: "task-9", extra: "keep-me" },
      errorMessage: "provider timeout",
      maxRetries: 5,
    });
    const insertedJob = buildJobTask({
      id: "job-cloned",
      status: "PENDING",
      jobType: "notification_task",
      subjectKind: "persona_task",
      subjectId: "task-9",
      dedupeKey: "notification_task:task-9",
      payload: { persona_task_id: "task-9", extra: "keep-me" },
      maxRetries: 5,
    });
    const insertPendingTask = vi.fn().mockResolvedValue(insertedJob);

    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn().mockResolvedValue(null),
        insertPendingTask,
        loadJobTask: vi.fn().mockResolvedValue(sourceJob),
      },
    });

    const result = await service.clone({
      jobId: "job-failed",
      requestedBy: "admin-user",
    });

    expect(result).toEqual({
      mode: "enqueued",
      task: insertedJob,
    });
    expect(insertPendingTask).toHaveBeenCalledWith({
      runtimeKey: "global",
      jobType: "notification_task",
      subjectKind: "persona_task",
      subjectId: "task-9",
      dedupeKey: "notification_task:task-9",
      payload: { persona_task_id: "task-9", extra: "keep-me" },
      requestedBy: "admin-user",
      maxRetries: 5,
    });
  });

  it("rejects cloning a non-terminal job", async () => {
    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn(),
        insertPendingTask: vi.fn(),
        loadJobTask: vi.fn().mockResolvedValue(
          buildJobTask({
            id: "job-running",
            status: "RUNNING",
          }),
        ),
      },
    });

    await expect(
      service.clone({
        jobId: "job-running",
        requestedBy: "admin-user",
      }),
    ).rejects.toThrow("only terminal job_tasks can be cloned");
  });

  it("retries a terminal errored job on the same row", async () => {
    const sourceJob = buildJobTask({
      id: "job-failed",
      status: "FAILED",
      errorMessage: "provider timeout",
      retryCount: 5,
      maxRetries: 5,
    });
    const retriedJob = buildJobTask({
      id: "job-failed",
      status: "PENDING",
      errorMessage: null,
      retryCount: 0,
      completedAt: null,
      startedAt: null,
    });
    const retryTask = vi.fn().mockResolvedValue(retriedJob);

    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn().mockResolvedValue(null),
        retryTask,
        loadJobTask: vi.fn().mockResolvedValue(sourceJob),
      },
    });

    const result = await service.retry({
      jobId: "job-failed",
      requestedBy: "admin-user",
    });

    expect(result).toEqual({
      mode: "retried",
      task: retriedJob,
    });
    expect(retryTask).toHaveBeenCalledWith({
      jobId: "job-failed",
      runtimeKey: "global",
      requestedBy: "admin-user",
    });
  });

  it("rejects retry when the job has no error message", async () => {
    const service = new AiAgentJobEnqueueService({
      deps: {
        runtimeKey: "global",
        findActiveByDedupeKey: vi.fn(),
        retryTask: vi.fn(),
        loadJobTask: vi.fn().mockResolvedValue(
          buildJobTask({
            id: "job-done",
            status: "DONE",
            errorMessage: null,
          }),
        ),
      },
    });

    await expect(
      service.retry({
        jobId: "job-done",
        requestedBy: "admin-user",
      }),
    ).rejects.toThrow("only terminal job_tasks with an error can be retried");
  });
});
