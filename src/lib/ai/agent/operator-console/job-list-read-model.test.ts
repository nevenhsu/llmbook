import { describe, expect, it, vi } from "vitest";
import type { AiAgentJobTask, AiAgentJobRuntimeStateSnapshot } from "@/lib/ai/agent/jobs/job-types";
import { AiAgentJobListReadModel } from "@/lib/ai/agent/operator-console/job-list-read-model";

function buildJob(overrides: Partial<AiAgentJobTask> = {}): AiAgentJobTask {
  const now = new Date("2026-04-08T12:00:00.000Z");
  return {
    id: overrides.id ?? "job-1",
    runtimeKey: overrides.runtimeKey ?? "global",
    jobType: overrides.jobType ?? "public_task",
    subjectKind: overrides.subjectKind ?? "persona_task",
    subjectId: overrides.subjectId ?? "task-1",
    dedupeKey: overrides.dedupeKey ?? "public_task:task-1",
    status: overrides.status ?? "PENDING",
    payload: overrides.payload ?? {},
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

const runtimeState: AiAgentJobRuntimeStateSnapshot = {
  runtimeKey: "global",
  paused: false,
  leaseOwner: null,
  leaseUntil: null,
  runtimeAppSeenAt: "2026-04-08T12:00:00.000Z",
  lastStartedAt: null,
  lastFinishedAt: null,
  updatedAt: "2026-04-08T12:00:00.000Z",
  statusLabel: "Idle",
  detail: "Jobs runtime is idle and ready to claim queue work.",
};

describe("AiAgentJobListReadModel", () => {
  it("returns active jobs before terminal rows and includes runtime state", async () => {
    const model = new AiAgentJobListReadModel({
      deps: {
        loadRuntimeState: vi.fn().mockResolvedValue(runtimeState),
        countActiveRows: vi.fn().mockResolvedValue(1),
        countTerminalRows: vi.fn().mockResolvedValue(1),
        loadActiveRows: vi
          .fn()
          .mockResolvedValue([buildJob({ id: "job-running", status: "RUNNING" })]),
        loadTerminalRows: vi.fn().mockResolvedValue([
          buildJob({
            id: "job-done",
            status: "DONE",
            completedAt: new Date("2026-04-08T11:00:00.000Z"),
          }),
        ]),
        buildTargets: vi.fn().mockResolvedValue(
          new Map([
            [
              "job-running",
              { kind: "task", label: "/r/board/posts/post-1", href: "/r/board/posts/post-1" },
            ],
            [
              "job-done",
              { kind: "task", label: "/r/board/posts/post-2", href: "/r/board/posts/post-2" },
            ],
          ]),
        ),
      },
    });

    const result = await model.list({ page: 1, pageSize: 10 });

    expect(result.runtimeState).toEqual(runtimeState);
    expect(result.rows.map((row) => row.id)).toEqual(["job-running", "job-done"]);
    expect(result.rows[0]?.status).toBe("RUNNING");
    expect(result.rows[0]?.errorMessage).toBeNull();
    expect(result.rows[0]?.canClone).toBe(false);
    expect(result.rows[0]?.canRetry).toBe(false);
    expect(result.rows[1]?.canClone).toBe(true);
  });

  it("surfaces errors and gates retry to rows with error messages", async () => {
    const model = new AiAgentJobListReadModel({
      deps: {
        loadRuntimeState: vi.fn().mockResolvedValue(runtimeState),
        countActiveRows: vi.fn().mockResolvedValue(0),
        countTerminalRows: vi.fn().mockResolvedValue(2),
        loadActiveRows: vi.fn().mockResolvedValue([]),
        loadTerminalRows: vi.fn().mockResolvedValue([
          buildJob({
            id: "job-failed",
            status: "FAILED",
            completedAt: new Date("2026-04-08T11:00:00.000Z"),
            errorMessage: "provider timeout",
          }),
          buildJob({
            id: "job-done",
            status: "DONE",
            completedAt: new Date("2026-04-08T10:00:00.000Z"),
            errorMessage: null,
          }),
        ]),
        buildTargets: vi.fn().mockResolvedValue(
          new Map([
            [
              "job-failed",
              { kind: "task", label: "/r/board/posts/post-1", href: "/r/board/posts/post-1" },
            ],
            [
              "job-done",
              { kind: "task", label: "/r/board/posts/post-2", href: "/r/board/posts/post-2" },
            ],
          ]),
        ),
      },
    });

    const result = await model.list({ page: 1, pageSize: 10 });

    expect(result.rows[0]).toMatchObject({
      id: "job-failed",
      errorMessage: "provider timeout",
      canClone: true,
      canRetry: true,
    });
    expect(result.rows[1]).toMatchObject({
      id: "job-done",
      errorMessage: null,
      canClone: true,
      canRetry: false,
    });
  });
});
