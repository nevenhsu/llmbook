import { describe, it, expect, vi } from "vitest";
import {
  ReplyExecutionAgent,
  InMemoryIdempotencyStore,
} from "@/agents/phase-1-reply-vote/orchestrator/reply-execution-agent";
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
    payload: overrides.payload ?? { idempotencyKey: "idem-1" },
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

describe("ReplyExecutionAgent", () => {
  it("executes reply task and marks DONE", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-1" }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "hello" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
    });

    const result = await agent.runOnce({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:01:00.000Z"),
    });

    expect(result).toBe("DONE");
    expect(writer.write).toHaveBeenCalledTimes(1);
    expect(store.snapshot()[0]?.status).toBe("DONE");
    expect(store.snapshot()[0]?.resultId).toBe("comment-1");
  });

  it("skips task when safety gate blocks content", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn(),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "risky" }) },
      safetyGate: {
        check: vi.fn().mockResolvedValue({
          allowed: false,
          reasonCode: "SAFETY_SIMILAR_TO_RECENT_REPLY",
          reason: "TOXIC_CONTENT",
        }),
      },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe("SAFETY_SIMILAR_TO_RECENT_REPLY");
  });

  it("passes safety context from generator into safety gate", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-1" }),
    };
    const safetyCheck = vi.fn().mockResolvedValue({ allowed: true });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: {
        generate: vi.fn().mockResolvedValue({
          text: "hello",
          safetyContext: { recentPersonaReplies: ["hello there"] },
        }),
      },
      safetyGate: { check: safetyCheck },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(safetyCheck).toHaveBeenCalledWith({
      text: "hello",
      context: { recentPersonaReplies: ["hello there"] },
    });
  });

  it("prevents duplicate writes for same idempotency key", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({ id: "task-1", payload: { idempotencyKey: "idem-1" } }),
      buildTask({
        id: "task-2",
        payload: { idempotencyKey: "idem-1" },
        scheduledAt: new Date("2026-02-23T00:00:01.000Z"),
      }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-1" }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "hello" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });
    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:05.000Z") });

    expect(writer.write).toHaveBeenCalledTimes(1);
    const tasks = store.snapshot().sort((a, b) => a.id.localeCompare(b.id));
    expect(tasks[0]?.status).toBe("DONE");
    expect(tasks[1]?.status).toBe("DONE");
    expect(tasks[1]?.resultId).toBe("comment-1");
  });

  it("skips non-reply tasks in reply-only phase", async () => {
    const store = new InMemoryTaskQueueStore([buildTask({ taskType: "vote", payload: {} })]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn(),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn() },
      safetyGate: { check: vi.fn() },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe("UNSUPPORTED_TASK_TYPE");
  });

  it("skips task when generator returns skip reason", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn(),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: {
        generate: vi.fn().mockResolvedValue({ skipReason: "NO_ELIGIBLE_TARGET_AVOID_SELF_TALK" }),
      },
      safetyGate: { check: vi.fn() },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe("NO_ELIGIBLE_TARGET_AVOID_SELF_TALK");
  });
});
