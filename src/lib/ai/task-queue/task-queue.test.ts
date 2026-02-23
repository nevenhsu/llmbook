import { describe, it, expect } from "vitest";
import {
  InMemoryTaskQueueStore,
  TaskQueue,
  type QueueTask,
  type TaskType,
} from "@/lib/ai/task-queue/task-queue";
import { InMemoryTaskEventSink } from "@/lib/ai/observability/task-events";

function buildTask(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    taskType: overrides.taskType ?? ("reply" as TaskType),
    payload: overrides.payload ?? {},
    status: overrides.status ?? "PENDING",
    scheduledAt: overrides.scheduledAt ?? new Date("2026-02-23T00:00:00.000Z"),
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    resultId: overrides.resultId,
    resultType: overrides.resultType,
    errorMessage: overrides.errorMessage,
    leaseOwner: overrides.leaseOwner,
    leaseUntil: overrides.leaseUntil,
    createdAt: overrides.createdAt ?? new Date("2026-02-23T00:00:00.000Z"),
  };
}

describe("TaskQueue", () => {
  it("claims one pending task atomically as RUNNING with lease", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({ id: "a", scheduledAt: new Date("2026-02-23T00:00:00.000Z") }),
      buildTask({ id: "b", scheduledAt: new Date("2026-02-23T00:00:01.000Z") }),
    ]);
    const sink = new InMemoryTaskEventSink();
    const queue = new TaskQueue({ store, eventSink: sink, leaseMs: 30_000 });

    const now = new Date("2026-02-23T01:00:00.000Z");
    const claimed = await queue.claimNextPending({ workerId: "worker-1", now });

    expect(claimed?.id).toBe("a");
    expect(claimed?.status).toBe("RUNNING");
    expect(claimed?.leaseOwner).toBe("worker-1");
    expect(claimed?.leaseUntil?.toISOString()).toBe("2026-02-23T01:00:30.000Z");
    expect(claimed?.startedAt?.toISOString()).toBe("2026-02-23T01:00:00.000Z");

    const snapshot = store.snapshot();
    expect(snapshot.find((t) => t.id === "a")?.status).toBe("RUNNING");
    expect(snapshot.find((t) => t.id === "b")?.status).toBe("PENDING");
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]?.fromStatus).toBe("PENDING");
    expect(sink.events[0]?.toStatus).toBe("RUNNING");
  });

  it("extends lease on heartbeat only for task owner", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({
        status: "RUNNING",
        startedAt: new Date("2026-02-23T00:00:00.000Z"),
        leaseOwner: "worker-1",
        leaseUntil: new Date("2026-02-23T00:00:20.000Z"),
      }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 45_000 });

    const denied = await queue.heartbeat({
      taskId: "task-1",
      workerId: "worker-2",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });
    expect(denied).toBeNull();

    const updated = await queue.heartbeat({
      taskId: "task-1",
      workerId: "worker-1",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });
    expect(updated?.leaseUntil?.toISOString()).toBe("2026-02-23T00:00:55.000Z");
  });

  it("recovers timed out RUNNING task back to PENDING", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({
        status: "RUNNING",
        startedAt: new Date("2026-02-23T00:00:00.000Z"),
        leaseOwner: "worker-1",
        leaseUntil: new Date("2026-02-23T00:00:05.000Z"),
      }),
    ]);
    const sink = new InMemoryTaskEventSink();
    const queue = new TaskQueue({ store, eventSink: sink, leaseMs: 30_000 });

    const recovered = await queue.recoverTimedOut({ now: new Date("2026-02-23T00:01:00.000Z") });

    expect(recovered).toBe(1);
    const task = store.snapshot()[0];
    expect(task?.status).toBe("PENDING");
    expect(task?.leaseOwner).toBeUndefined();
    expect(task?.leaseUntil).toBeUndefined();
    expect(task?.startedAt).toBeUndefined();
    expect(sink.events.some((e) => e.reasonCode === "LEASE_TIMEOUT")).toBe(true);
  });

  it("requeues failed task before max retries, then hard-fails at limit", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({
        status: "RUNNING",
        startedAt: new Date("2026-02-23T00:00:00.000Z"),
        leaseOwner: "worker-1",
        leaseUntil: new Date("2026-02-23T00:00:30.000Z"),
        retryCount: 0,
        maxRetries: 2,
      }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const first = await queue.fail({
      taskId: "task-1",
      workerId: "worker-1",
      errorMessage: "upstream error",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });
    expect(first?.status).toBe("PENDING");
    expect(first?.retryCount).toBe(1);
    expect(first?.errorMessage).toBe("upstream error");

    await queue.claimNextPending({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:00:11.000Z"),
    });

    const second = await queue.fail({
      taskId: "task-1",
      workerId: "worker-1",
      errorMessage: "still failing",
      now: new Date("2026-02-23T00:00:20.000Z"),
    });
    expect(second?.status).toBe("FAILED");
    expect(second?.retryCount).toBe(2);
    expect(second?.completedAt?.toISOString()).toBe("2026-02-23T00:00:20.000Z");
  });

  it("marks task as DONE with result payload", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({
        status: "RUNNING",
        startedAt: new Date("2026-02-23T00:00:00.000Z"),
        leaseOwner: "worker-1",
        leaseUntil: new Date("2026-02-23T00:00:30.000Z"),
      }),
    ]);
    const queue = new TaskQueue({
      store,
      eventSink: new InMemoryTaskEventSink(),
      leaseMs: 30_000,
    });

    const done = await queue.complete({
      taskId: "task-1",
      workerId: "worker-1",
      resultId: "result-1",
      resultType: "comment",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });

    expect(done?.status).toBe("DONE");
    expect(done?.resultId).toBe("result-1");
    expect(done?.resultType).toBe("comment");
    expect(done?.completedAt?.toISOString()).toBe("2026-02-23T00:00:10.000Z");
    expect(done?.leaseOwner).toBeUndefined();
    expect(done?.leaseUntil).toBeUndefined();
  });

  it("marks RUNNING task as SKIPPED with reason", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({
        status: "RUNNING",
        startedAt: new Date("2026-02-23T00:00:00.000Z"),
        leaseOwner: "worker-1",
        leaseUntil: new Date("2026-02-23T00:00:30.000Z"),
      }),
    ]);
    const queue = new TaskQueue({
      store,
      eventSink: new InMemoryTaskEventSink(),
      leaseMs: 30_000,
    });

    const skipped = await queue.skip({
      taskId: "task-1",
      workerId: "worker-1",
      reason: "SAFETY_BLOCKED",
      now: new Date("2026-02-23T00:00:10.000Z"),
    });

    expect(skipped?.status).toBe("SKIPPED");
    expect(skipped?.errorMessage).toBe("SAFETY_BLOCKED");
    expect(skipped?.completedAt?.toISOString()).toBe("2026-02-23T00:00:10.000Z");
  });
});
