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
import { InMemorySafetyEventSink } from "@/lib/ai/observability/safety-events";
import { InMemoryReviewQueueStore, ReviewQueue } from "@/lib/ai/review-queue/review-queue";
import {
  CachedReplyPolicyProvider,
  type PolicyReleaseStore,
} from "@/lib/ai/policy/policy-control-plane";
import {
  ExecutionSkipReasonCode,
  GeneratorSkipReasonCode,
  PolicyControlPlaneReasonCode,
  ReviewReasonCode,
  SafetyReasonCode,
} from "@/lib/ai/reason-codes";

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
          reasonCode: SafetyReasonCode.similarToRecentReply,
          reason: "TOXIC_CONTENT",
        }),
      },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe(SafetyReasonCode.similarToRecentReply);
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

  it("records safety observability event on reason-coded block", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({ payload: { idempotencyKey: "idem-1", postId: "post-1" } }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const safetyEventSink = new InMemorySafetyEventSink();

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "risky" }) },
      safetyGate: {
        check: vi.fn().mockResolvedValue({
          allowed: false,
          reasonCode: SafetyReasonCode.similarToRecentReply,
          reason: "similarity 0.95 >= 0.90",
        }),
      },
      writer: { write: vi.fn() },
      safetyEventSink,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(safetyEventSink.events).toHaveLength(1);
    expect(safetyEventSink.events[0]?.source).toBe("execution");
    expect(safetyEventSink.events[0]?.reasonCode).toBe(SafetyReasonCode.similarToRecentReply);
    expect(safetyEventSink.events[0]?.similarity).toBe(0.95);
  });

  it("routes review-required safety blocks into review queue instead of skipping", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const reviewStore = new InMemoryReviewQueueStore({
      tasks: [buildTask({ status: "IN_REVIEW" })],
    });
    const reviewQueue = new ReviewQueue({ store: reviewStore });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "needs manual check" }) },
      safetyGate: {
        check: vi.fn().mockResolvedValue({
          allowed: false,
          reviewRequired: true,
          riskLevel: "HIGH",
          reasonCode: ReviewReasonCode.reviewRequired,
        }),
      },
      writer: { write: vi.fn() },
      reviewQueue,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(store.snapshot()[0]?.status).toBe("IN_REVIEW");
    const reviews = await reviewQueue.list({ statuses: ["PENDING"] });
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.taskId).toBe("task-1");
    expect(reviews[0]?.enqueueReasonCode).toBe(ReviewReasonCode.reviewRequired);
    expect(reviews[0]?.metadata).toMatchObject({
      source: "execution_safety_gate",
      generatedText: "needs manual check",
      safetyReasonCode: ReviewReasonCode.reviewRequired,
      safetyRiskLevel: "HIGH",
    });

    const events = await reviewQueue.listEvents({ reviewId: reviews[0]?.id, limit: 5 });
    expect(events[0]?.eventType).toBe("ENQUEUED");
    expect(events[0]?.metadata).toMatchObject({
      generatedText: "needs manual check",
      safetyReasonCode: ReviewReasonCode.reviewRequired,
    });
  });

  it("uses atomic persistence path when provided", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const writer = {
      write: vi.fn(),
    };
    const idempotency = new InMemoryIdempotencyStore();
    const atomicPersistence = {
      writeIdempotentAndComplete: vi.fn().mockResolvedValue({ resultId: "comment-atomic-1" }),
    };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency,
      generator: { generate: vi.fn().mockResolvedValue({ text: "hello" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
      atomicPersistence,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(atomicPersistence.writeIdempotentAndComplete).toHaveBeenCalledTimes(1);
    expect(writer.write).not.toHaveBeenCalled();
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
    expect(store.snapshot()[0]?.errorMessage).toBe(ExecutionSkipReasonCode.unsupportedTaskType);
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
        generate: vi
          .fn()
          .mockResolvedValue({ skipReason: GeneratorSkipReasonCode.noEligibleTargetAvoidSelfTalk }),
      },
      safetyGate: { check: vi.fn() },
      writer,
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe(
      GeneratorSkipReasonCode.noEligibleTargetAvoidSelfTalk,
    );
  });

  it("opens circuit breaker on empty generated reply and pauses further claims", async () => {
    const store = new InMemoryTaskQueueStore([
      buildTask({ id: "task-1", payload: { idempotencyKey: "idem-1" } }),
      buildTask({
        id: "task-2",
        payload: { idempotencyKey: "idem-2" },
        scheduledAt: new Date("2026-02-23T00:00:01.000Z"),
      }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "" }) },
      safetyGate: { check: vi.fn() },
      writer: { write: vi.fn() },
      emptyReplyCircuitBreakerThreshold: 1,
    });

    const first = await agent.runOnce({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:01:00.000Z"),
    });
    const second = await agent.runOnce({
      workerId: "worker-1",
      now: new Date("2026-02-23T00:01:01.000Z"),
    });

    expect(first).toBe("DONE");
    expect(second).toBe("IDLE");
    const tasks = store.snapshot().sort((a, b) => a.id.localeCompare(b.id));
    expect(tasks[0]?.status).toBe("SKIPPED");
    expect(tasks[0]?.errorMessage).toBe(ExecutionSkipReasonCode.emptyGeneratedReply);
    expect(tasks[1]?.status).toBe("PENDING");
  });

  it("skips task when policy provider disables reply capability", async () => {
    const store = new InMemoryTaskQueueStore([buildTask()]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const writer = { write: vi.fn() };

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn() },
      safetyGate: { check: vi.fn() },
      writer,
      policyProvider: {
        getReplyPolicy: vi.fn().mockResolvedValue({
          replyEnabled: false,
          precheckEnabled: true,
          perPersonaHourlyReplyLimit: 8,
          perPostCooldownSeconds: 180,
          precheckSimilarityThreshold: 0.9,
        }),
      },
    });

    await agent.runOnce({ workerId: "worker-1", now: new Date("2026-02-23T00:01:00.000Z") });

    expect(writer.write).not.toHaveBeenCalled();
    expect(store.snapshot()[0]?.status).toBe("SKIPPED");
    expect(store.snapshot()[0]?.errorMessage).toBe(ExecutionSkipReasonCode.policyDisabled);
  });

  it("applies hot-updated policy to new tasks and falls back to last-known-good on provider load failure", async () => {
    const now = { value: new Date("2026-02-26T00:00:00.000Z") };
    let fetchCount = 0;
    const store = new InMemoryTaskQueueStore([
      buildTask({
        id: "task-1",
        payload: { idempotencyKey: "idem-1" },
        scheduledAt: new Date("2026-02-26T00:00:00.000Z"),
      }),
      buildTask({
        id: "task-2",
        payload: { idempotencyKey: "idem-2" },
        scheduledAt: new Date("2026-02-26T00:00:01.000Z"),
      }),
      buildTask({
        id: "task-3",
        payload: { idempotencyKey: "idem-3" },
        scheduledAt: new Date("2026-02-26T00:00:02.000Z"),
      }),
    ]);
    const queue = new TaskQueue({ store, eventSink: new InMemoryTaskEventSink(), leaseMs: 30_000 });
    const writer = {
      write: vi.fn().mockResolvedValue({ resultId: "comment-1" }),
    };

    const policyStore: PolicyReleaseStore = {
      async fetchLatestActive() {
        fetchCount += 1;
        if (fetchCount === 1) {
          return {
            version: 10,
            isActive: true,
            createdAt: "2026-02-26T00:00:00.000Z",
            policy: { global: { replyEnabled: false } },
          };
        }
        if (fetchCount === 2) {
          return {
            version: 11,
            isActive: true,
            createdAt: "2026-02-26T00:01:00.000Z",
            policy: { global: { replyEnabled: true } },
          };
        }
        throw new Error("db unavailable");
      },
    };

    const policyProvider = new CachedReplyPolicyProvider({
      store: policyStore,
      now: () => now.value,
      ttlMs: 10_000,
      fallbackPolicy: {
        replyEnabled: true,
        precheckEnabled: true,
        perPersonaHourlyReplyLimit: 8,
        perPostCooldownSeconds: 180,
        precheckSimilarityThreshold: 0.9,
      },
    });

    const agent = new ReplyExecutionAgent({
      queue,
      idempotency: new InMemoryIdempotencyStore(),
      generator: { generate: vi.fn().mockResolvedValue({ text: "hello" }) },
      safetyGate: { check: vi.fn().mockResolvedValue({ allowed: true }) },
      writer,
      policyProvider,
    });

    await agent.runOnce({ workerId: "worker-1", now: now.value });
    now.value = new Date("2026-02-26T00:00:11.000Z");
    await agent.runOnce({ workerId: "worker-1", now: now.value });
    now.value = new Date("2026-02-26T00:00:22.000Z");
    await agent.runOnce({ workerId: "worker-1", now: now.value });

    const tasks = store.snapshot().sort((a, b) => a.id.localeCompare(b.id));
    expect(tasks[0]?.status).toBe("SKIPPED");
    expect(tasks[0]?.errorMessage).toBe(ExecutionSkipReasonCode.policyDisabled);
    expect(tasks[1]?.status).toBe("DONE");
    expect(tasks[2]?.status).toBe("DONE");
    expect(writer.write).toHaveBeenCalledTimes(2);
    expect(policyProvider.getStatus().lastFallbackReasonCode).toBe(
      PolicyControlPlaneReasonCode.fallbackLastKnownGood,
    );
  });
});
