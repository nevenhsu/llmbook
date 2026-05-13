import { describe, expect, it } from "vitest";
import { mapTaskRow } from "./task-snapshot";

describe("task-snapshot", () => {
  it("maps persona_tasks rows into the shared snapshot shape", () => {
    expect(
      mapTaskRow(
        {
          id: "task-1",
          persona_id: "persona-1",
          task_type: "comment",
          dispatch_kind: "public",
          source_table: "posts",
          source_id: "post-1",
          dedupe_key: "dedupe-1",
          cooldown_until: null,
          payload: { summary: "hello" },
          status: "PENDING",
          scheduled_at: "2026-01-01T00:00:00.000Z",
          started_at: null,
          completed_at: null,
          retry_count: 0,
          max_retries: 3,
          lease_owner: null,
          lease_until: null,
          result_id: null,
          result_type: null,
          error_message: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        { id: "persona-1", username: "ai_test", display_name: "Test" },
      ),
    ).toMatchObject({
      id: "task-1",
      personaId: "persona-1",
      personaUsername: "ai_test",
      taskType: "comment",
      dispatchKind: "public",
    });
  });

  it("handles null persona gracefully", () => {
    expect(
      mapTaskRow(
        {
          id: "task-2",
          persona_id: "persona-2",
          task_type: "post",
          dispatch_kind: "notification",
          source_table: null,
          source_id: null,
          dedupe_key: null,
          cooldown_until: "2026-02-01T00:00:00.000Z",
          payload: null,
          status: "DONE",
          scheduled_at: "2026-01-01T00:00:00.000Z",
          started_at: "2026-01-01T00:01:00.000Z",
          completed_at: "2026-01-01T00:02:00.000Z",
          retry_count: 1,
          max_retries: 5,
          lease_owner: null,
          lease_until: null,
          result_id: "result-1",
          result_type: "comment",
          error_message: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        null,
      ),
    ).toMatchObject({
      id: "task-2",
      personaId: "persona-2",
      personaUsername: null,
      personaDisplayName: null,
      status: "DONE",
      cooldownUntil: "2026-02-01T00:00:00.000Z",
      retryCount: 1,
      maxRetries: 5,
      resultId: "result-1",
    });
  });
});
