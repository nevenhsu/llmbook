import { beforeEach, describe, expect, it, vi } from "vitest";

const runInPostgresTransaction = vi.fn();

vi.mock("@/lib/supabase/postgres", () => ({
  runInPostgresTransaction,
}));

describe("SupabaseReviewQueueStore atomic transaction path", () => {
  beforeEach(() => {
    vi.resetModules();
    runInPostgresTransaction.mockReset();
  });

  it("claimAtomic updates review and writes CLAIMED event", async () => {
    const reviewRow = {
      id: "review-1",
      task_id: "task-1",
      persona_id: "persona-1",
      risk_level: "HIGH",
      status: "IN_REVIEW",
      enqueue_reason_code: "review_required",
      decision: null,
      decision_reason_code: null,
      reviewer_id: "admin-1",
      note: null,
      expires_at: "2026-02-27T00:00:00.000Z",
      claimed_at: "2026-02-24T00:00:00.000Z",
      decided_at: null,
      created_at: "2026-02-24T00:00:00.000Z",
      updated_at: "2026-02-24T00:00:00.000Z",
      metadata: {},
    };

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("update public.ai_review_queue")) {
        return { rows: [reviewRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    runInPostgresTransaction.mockImplementation(async (work) => work({ query, release: vi.fn() }));

    const { SupabaseReviewQueueStore } =
      await import("@/lib/ai/review-queue/supabase-review-queue-store");

    const store = new SupabaseReviewQueueStore();
    const result = await store.claimAtomic({
      reviewId: "review-1",
      reviewerId: "admin-1",
      now: new Date("2026-02-24T00:00:00.000Z"),
    });

    expect(result?.id).toBe("review-1");
    expect(result?.status).toBe("IN_REVIEW");
    expect(
      query.mock.calls.some(
        (call) =>
          String(call[0]).includes("insert into public.ai_review_events") &&
          String(call[0]).includes("CLAIMED"),
      ),
    ).toBe(true);
  });

  it("approveAtomic writes review/task/event/transition in one transaction", async () => {
    const reviewRow = {
      id: "review-2",
      task_id: "task-2",
      persona_id: "persona-1",
      risk_level: "HIGH",
      status: "IN_REVIEW",
      enqueue_reason_code: "review_required",
      decision: null,
      decision_reason_code: null,
      reviewer_id: "admin-1",
      note: null,
      expires_at: "2026-02-27T00:00:00.000Z",
      claimed_at: "2026-02-24T00:00:00.000Z",
      decided_at: null,
      created_at: "2026-02-24T00:00:00.000Z",
      updated_at: "2026-02-24T00:00:00.000Z",
      metadata: {},
    };

    const taskRow = {
      id: "task-2",
      persona_id: "persona-1",
      task_type: "reply",
      status: "IN_REVIEW",
      retry_count: 0,
    };

    const approvedRow = {
      ...reviewRow,
      status: "APPROVED",
      decision: "APPROVE",
      decision_reason_code: "manual_approved",
      decided_at: "2026-02-24T00:10:00.000Z",
    };

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.ai_review_queue") && sql.includes("for update")) {
        return { rows: [reviewRow], rowCount: 1 };
      }
      if (sql.includes("from public.persona_tasks") && sql.includes("for update")) {
        return { rows: [taskRow], rowCount: 1 };
      }
      if (sql.includes("update public.ai_review_queue") && sql.includes("APPROVED")) {
        return { rows: [approvedRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    runInPostgresTransaction.mockImplementation(async (work) => work({ query, release: vi.fn() }));

    const { SupabaseReviewQueueStore } =
      await import("@/lib/ai/review-queue/supabase-review-queue-store");

    const store = new SupabaseReviewQueueStore();
    const result = await store.approveAtomic({
      reviewId: "review-2",
      reviewerId: "admin-1",
      reasonCode: "manual_approved",
      now: new Date("2026-02-24T00:10:00.000Z"),
    });

    expect(result?.status).toBe("APPROVED");
    expect(query.mock.calls.some((call) => String(call[0]).includes("REVIEW_APPROVED"))).toBe(true);
  });

  it("expireDueAtomic returns number of expired rows", async () => {
    const dueReview = {
      id: "review-3",
      task_id: "task-3",
      persona_id: "persona-1",
      risk_level: "HIGH",
      status: "IN_REVIEW",
      enqueue_reason_code: "review_required",
      decision: null,
      decision_reason_code: null,
      reviewer_id: "admin-1",
      note: null,
      expires_at: "2026-02-21T00:00:00.000Z",
      claimed_at: "2026-02-20T00:00:00.000Z",
      decided_at: null,
      created_at: "2026-02-20T00:00:00.000Z",
      updated_at: "2026-02-20T00:00:00.000Z",
      metadata: {},
    };

    const taskRow = {
      id: "task-3",
      persona_id: "persona-1",
      task_type: "reply",
      status: "IN_REVIEW",
      retry_count: 1,
    };

    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.ai_review_queue") && sql.includes("for update skip locked")) {
        return { rows: [dueReview], rowCount: 1 };
      }
      if (sql.includes("from public.persona_tasks") && sql.includes("for update")) {
        return { rows: [taskRow], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });

    runInPostgresTransaction.mockImplementation(async (work) => work({ query, release: vi.fn() }));

    const { SupabaseReviewQueueStore } =
      await import("@/lib/ai/review-queue/supabase-review-queue-store");

    const store = new SupabaseReviewQueueStore();
    const count = await store.expireDueAtomic({
      now: new Date("2026-02-24T00:00:00.000Z"),
    });

    expect(count).toBe(1);
    expect(query.mock.calls.some((call) => String(call[0]).includes("REVIEW_EXPIRED"))).toBe(true);
  });
});
