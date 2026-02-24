import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueTask } from "@/lib/ai/task-queue/task-queue";

const runInPostgresTransaction = vi.fn();

vi.mock("@/lib/supabase/postgres", () => ({
  runInPostgresTransaction,
}));

function buildTask(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    taskType: overrides.taskType ?? "reply",
    payload: overrides.payload ?? { postId: "post-1" },
    status: overrides.status ?? "RUNNING",
    scheduledAt: overrides.scheduledAt ?? new Date("2026-02-24T00:00:00.000Z"),
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    createdAt: overrides.createdAt ?? new Date("2026-02-24T00:00:00.000Z"),
    startedAt: overrides.startedAt,
    completedAt: overrides.completedAt,
    errorMessage: overrides.errorMessage,
    leaseOwner: overrides.leaseOwner,
    leaseUntil: overrides.leaseUntil,
    resultId: overrides.resultId,
    resultType: overrides.resultType,
  };
}

describe("SupabaseReplyAtomicPersistence", () => {
  beforeEach(() => {
    vi.resetModules();
    runInPostgresTransaction.mockReset();
  });

  it("creates comment, idempotency row, and task DONE in one transaction", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.task_idempotency_keys")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("insert into public.comments")) {
        return { rows: [{ id: "comment-1" }], rowCount: 1 };
      }
      if (sql.includes("update public.persona_tasks") && sql.includes("returning")) {
        return {
          rows: [{ persona_id: "persona-1", task_type: "reply", retry_count: 0 }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });

    runInPostgresTransaction.mockImplementation(async (work) => work({ query, release: vi.fn() }));

    const { SupabaseReplyAtomicPersistence } = await import("./supabase-reply-atomic-persistence");

    const persistence = new SupabaseReplyAtomicPersistence();
    const result = await persistence.writeIdempotentAndComplete({
      task: buildTask(),
      workerId: "worker-1",
      now: new Date("2026-02-24T00:10:00.000Z"),
      text: "hello",
      idempotencyKey: "idem-1",
      parentCommentId: undefined,
    });

    expect(result?.resultId).toBe("comment-1");
    expect(
      query.mock.calls.some((call) => String(call[0]).includes("task_transition_events")),
    ).toBe(true);
  });

  it("reuses existing idempotency result and still finalizes task", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("from public.task_idempotency_keys")) {
        return { rows: [{ result_id: "comment-existing" }], rowCount: 1 };
      }
      if (sql.includes("update public.persona_tasks")) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    runInPostgresTransaction.mockImplementation(async (work) => work({ query, release: vi.fn() }));

    const { SupabaseReplyAtomicPersistence } = await import("./supabase-reply-atomic-persistence");

    const persistence = new SupabaseReplyAtomicPersistence();
    const result = await persistence.writeIdempotentAndComplete({
      task: buildTask(),
      workerId: "worker-1",
      now: new Date("2026-02-24T00:10:00.000Z"),
      text: "hello",
      idempotencyKey: "idem-1",
      parentCommentId: undefined,
    });

    expect(result?.resultId).toBe("comment-existing");
    expect(
      query.mock.calls.some((call) => String(call[0]).includes("insert into public.comments")),
    ).toBe(false);
  });
});
