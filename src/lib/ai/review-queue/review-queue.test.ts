import { describe, expect, it } from "vitest";
import {
  InMemoryReviewQueueStore,
  ReviewQueue,
  type ReviewQueueAtomicStore,
  type ReviewQueueTask,
} from "@/lib/ai/review-queue/review-queue";

function buildTask(overrides: Partial<ReviewQueueTask> = {}): ReviewQueueTask {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    taskType: overrides.taskType ?? "reply",
    status: overrides.status ?? "IN_REVIEW",
    payload: overrides.payload ?? {},
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    scheduledAt: overrides.scheduledAt ?? new Date("2026-02-24T00:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2026-02-24T00:00:00.000Z"),
    completedAt: overrides.completedAt,
    startedAt: overrides.startedAt,
    errorMessage: overrides.errorMessage,
  };
}

describe("ReviewQueue", () => {
  function createConnectionError(): Error & { code?: string } {
    const error = new Error("getaddrinfo ENOTFOUND db.example.supabase.co") as Error & {
      code?: string;
    };
    error.code = "ENOTFOUND";
    return error;
  }

  class FailingAtomicClaimStore extends InMemoryReviewQueueStore implements ReviewQueueAtomicStore {
    public claimAtomic(): null {
      throw createConnectionError();
    }
    public approveAtomic(): null {
      return null;
    }
    public rejectAtomic(): null {
      return null;
    }
    public expireDueAtomic(): number {
      return 0;
    }
  }

  class FailingAtomicApproveStore
    extends InMemoryReviewQueueStore
    implements ReviewQueueAtomicStore
  {
    public claimAtomic(): null {
      return null;
    }
    public approveAtomic(): null {
      throw createConnectionError();
    }
    public rejectAtomic(): null {
      return null;
    }
    public expireDueAtomic(): number {
      return 0;
    }
  }

  class FailingAtomicRejectStore
    extends InMemoryReviewQueueStore
    implements ReviewQueueAtomicStore
  {
    public claimAtomic(): null {
      return null;
    }
    public approveAtomic(): null {
      return null;
    }
    public rejectAtomic(): null {
      throw createConnectionError();
    }
    public expireDueAtomic(): number {
      return 0;
    }
  }

  class FailingAtomicExpireStore
    extends InMemoryReviewQueueStore
    implements ReviewQueueAtomicStore
  {
    public claimAtomic(): null {
      return null;
    }
    public approveAtomic(): null {
      return null;
    }
    public rejectAtomic(): null {
      return null;
    }
    public expireDueAtomic(): number {
      throw createConnectionError();
    }
  }

  it("approves review item and sends task back to PENDING", async () => {
    const store = new InMemoryReviewQueueStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "IN_REVIEW",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
          reviewerId: "admin-1",
          claimedAt: new Date("2026-02-24T00:01:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });

    const approved = await queue.approve({
      reviewId: "review-1",
      reviewerId: "admin-1",
      reasonCode: "manual_approved",
      now: new Date("2026-02-24T00:03:00.000Z"),
    });

    expect(approved?.status).toBe("APPROVED");
    expect(approved?.decision).toBe("APPROVE");

    const task = store.getTask("task-1");
    expect(task?.status).toBe("PENDING");
    expect(task?.errorMessage).toBeUndefined();

    const events = store.listEventsForReview("review-1");
    expect(events.some((event) => event.eventType === "APPROVED")).toBe(true);
  });

  it("rejects review item and skips task", async () => {
    const store = new InMemoryReviewQueueStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "GRAY",
          status: "IN_REVIEW",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
          reviewerId: "admin-1",
          claimedAt: new Date("2026-02-24T00:01:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });

    const rejected = await queue.reject({
      reviewId: "review-1",
      reviewerId: "admin-1",
      reasonCode: "policy_reject",
      note: "unsafe",
      now: new Date("2026-02-24T00:04:00.000Z"),
    });

    expect(rejected?.status).toBe("REJECTED");
    expect(rejected?.decision).toBe("REJECT");

    const task = store.getTask("task-1");
    expect(task?.status).toBe("SKIPPED");
    expect(task?.errorMessage).toBe("policy_reject");
  });

  it("expires pending items older than 3 days and skips tasks", async () => {
    const store = new InMemoryReviewQueueStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "PENDING",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
          expiresAt: new Date("2026-02-23T00:00:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });

    const expired = await queue.expireDue({ now: new Date("2026-02-24T00:00:00.000Z") });

    expect(expired).toHaveLength(1);
    expect(expired[0]?.status).toBe("EXPIRED");
    expect(expired[0]?.decisionReasonCode).toBe("review_timeout_expired");

    const task = store.getTask("task-1");
    expect(task?.status).toBe("SKIPPED");
    expect(task?.errorMessage).toBe("review_timeout_expired");
  });

  it("falls back to non-atomic claim when atomic DB connection fails", async () => {
    const store = new FailingAtomicClaimStore({
      tasks: [buildTask({ status: "IN_REVIEW" })],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "PENDING",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    const claimed = await queue.claim({
      reviewId: "review-1",
      reviewerId: "admin-1",
      now: new Date("2026-02-24T00:00:30.000Z"),
    });

    expect(claimed?.status).toBe("IN_REVIEW");
    const warnings = queue.consumeWarnings();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("fallback mode");
    expect(queue.consumeWarnings()).toHaveLength(0);
  });

  it("falls back to non-atomic approve when atomic DB connection fails", async () => {
    const store = new FailingAtomicApproveStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "IN_REVIEW",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
          reviewerId: "admin-1",
          claimedAt: new Date("2026-02-24T00:01:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    const approved = await queue.approve({
      reviewId: "review-1",
      reviewerId: "admin-1",
      reasonCode: "manual_approved",
      now: new Date("2026-02-24T00:03:00.000Z"),
    });

    expect(approved?.status).toBe("APPROVED");
    expect(queue.consumeWarnings()).toHaveLength(1);
  });

  it("falls back to non-atomic reject when atomic DB connection fails", async () => {
    const store = new FailingAtomicRejectStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "GRAY",
          status: "IN_REVIEW",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
          reviewerId: "admin-1",
          claimedAt: new Date("2026-02-24T00:01:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    const rejected = await queue.reject({
      reviewId: "review-1",
      reviewerId: "admin-1",
      reasonCode: "policy_reject",
      note: "unsafe",
      now: new Date("2026-02-24T00:04:00.000Z"),
    });

    expect(rejected?.status).toBe("REJECTED");
    expect(queue.consumeWarnings()).toHaveLength(1);
  });

  it("falls back to non-atomic expire when atomic DB connection fails", async () => {
    const store = new FailingAtomicExpireStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "PENDING",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-20T00:00:00.000Z"),
          updatedAt: new Date("2026-02-20T00:00:00.000Z"),
          expiresAt: new Date("2026-02-23T00:00:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    const expired = await queue.expireDue({ now: new Date("2026-02-24T00:00:00.000Z") });

    expect(expired).toHaveLength(1);
    expect(expired[0]?.status).toBe("EXPIRED");

    const task = store.getTask("task-1");
    expect(task?.status).toBe("SKIPPED");
    expect(task?.errorMessage).toBe("review_timeout_expired");
    expect(queue.consumeWarnings()).toHaveLength(1);
  });

  it("claims pending review item into IN_REVIEW", async () => {
    const store = new InMemoryReviewQueueStore({
      tasks: [buildTask({ status: "IN_REVIEW" })],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "PENDING",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    const claimed = await queue.claim({
      reviewId: "review-1",
      reviewerId: "admin-1",
      now: new Date("2026-02-24T00:00:30.000Z"),
    });

    expect(claimed?.status).toBe("IN_REVIEW");
    expect(claimed?.reviewerId).toBe("admin-1");
    expect(claimed?.claimedAt?.toISOString()).toBe("2026-02-24T00:00:30.000Z");
  });

  it("lists audit events and supports review filter", async () => {
    const store = new InMemoryReviewQueueStore({
      tasks: [buildTask()],
      reviews: [
        {
          id: "review-1",
          taskId: "task-1",
          personaId: "persona-1",
          riskLevel: "HIGH",
          status: "PENDING",
          enqueueReasonCode: "review_required",
          createdAt: new Date("2026-02-24T00:00:00.000Z"),
          updatedAt: new Date("2026-02-24T00:00:00.000Z"),
          expiresAt: new Date("2026-02-27T00:00:00.000Z"),
        },
      ],
    });

    const queue = new ReviewQueue({ store });
    await queue.enqueue({
      taskId: "task-1",
      personaId: "persona-1",
      riskLevel: "HIGH",
      enqueueReasonCode: "review_required",
      now: new Date("2026-02-24T00:00:00.000Z"),
    });
    await queue.claim({
      reviewId: "review-1",
      reviewerId: "admin-1",
      now: new Date("2026-02-24T00:01:00.000Z"),
    });

    const all = await queue.listEvents({ limit: 10 });
    const filtered = await queue.listEvents({ reviewId: "review-1", limit: 10 });

    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(filtered.every((event) => event.reviewId === "review-1")).toBe(true);
  });
});
