import { describe, expect, it, vi } from "vitest";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import { AiAgentTaskTableReadModel } from "@/lib/ai/agent/operator-console/task-table-read-model";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "comment",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-1",
    dedupeKey: overrides.dedupeKey ?? "dedupe-1",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? {},
    status: overrides.status ?? "PENDING",
    scheduledAt: overrides.scheduledAt ?? "2026-04-08T12:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? null,
    leaseUntil: overrides.leaseUntil ?? null,
    resultId: overrides.resultId ?? null,
    resultType: overrides.resultType ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-04-08T11:55:00.000Z",
  };
}

describe("AiAgentTaskTableReadModel", () => {
  it("puts active queue rows before terminal rows across page boundaries", async () => {
    const activeRows = [
      buildTask({
        id: "task-pending-2",
        status: "PENDING",
        scheduledAt: "2026-04-08T12:04:00.000Z",
      }),
      buildTask({
        id: "task-running-1",
        status: "RUNNING",
        scheduledAt: "2026-04-08T12:03:00.000Z",
      }),
    ];
    const terminalRows = [
      buildTask({
        id: "task-done-3",
        status: "DONE",
        completedAt: "2026-04-08T12:02:00.000Z",
        resultId: "comment-1",
        resultType: "comment",
      }),
      buildTask({
        id: "task-done-2",
        status: "DONE",
        completedAt: "2026-04-08T12:01:00.000Z",
        resultId: "comment-2",
        resultType: "comment",
      }),
      buildTask({
        id: "task-done-1",
        status: "DONE",
        completedAt: "2026-04-08T12:00:00.000Z",
        resultId: "comment-3",
        resultType: "comment",
      }),
    ];

    const model = new AiAgentTaskTableReadModel({
      deps: {
        loadActiveRows: vi.fn().mockResolvedValue(activeRows),
        countActiveRows: vi.fn().mockResolvedValue(activeRows.length),
        loadTerminalRows: vi
          .fn()
          .mockImplementation(({ offset, limit }) =>
            Promise.resolve(terminalRows.slice(offset, offset + limit)),
          ),
        countTerminalRows: vi.fn().mockResolvedValue(terminalRows.length),
        loadTargetMap: vi.fn().mockResolvedValue(new Map()),
      },
    });

    const firstPage = await model.list({ kind: "public", page: 1, pageSize: 3 });
    const secondPage = await model.list({ kind: "public", page: 2, pageSize: 3 });

    expect(firstPage.rows.map((row) => row.id)).toEqual([
      "task-pending-2",
      "task-running-1",
      "task-done-3",
    ]);
    expect(secondPage.rows.map((row) => row.id)).toEqual(["task-done-2", "task-done-1"]);
  });

  it("exposes compact flow failure metadata from terminal task errors", async () => {
    const terminalRows = [
      buildTask({
        id: "task-failed-1",
        status: "FAILED",
        completedAt: "2026-04-08T12:02:00.000Z",
        errorMessage:
          'reply output must be valid JSON flow_failure={"flowKind":"reply","causeCategory":"schema_validation","terminalStage":"reply_body.main"}',
      }),
    ];

    const model = new AiAgentTaskTableReadModel({
      deps: {
        loadActiveRows: vi.fn().mockResolvedValue([]),
        countActiveRows: vi.fn().mockResolvedValue(0),
        loadTerminalRows: vi.fn().mockResolvedValue(terminalRows),
        countTerminalRows: vi.fn().mockResolvedValue(terminalRows.length),
        loadTargetMap: vi.fn().mockResolvedValue(new Map()),
      },
    });

    const result = await model.list({ kind: "public", page: 1, pageSize: 10 });

    expect(result.rows[0]).toMatchObject({
      id: "task-failed-1",
      errorMessage: expect.stringContaining("flow_failure="),
      flowFailure: {
        flowKind: "reply",
        causeCategory: "schema_validation",
        terminalStage: "reply_body.main",
      },
    });
  });
});
