import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, previewAction, executeAction } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  previewAction: vi.fn(),
  executeAction: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/server/route-helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    http: {
      badRequest: (message = "Bad Request") =>
        NextResponse.json({ error: message }, { status: 400 }),
      forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
      notFound: (message = "Not Found") => NextResponse.json({ error: message }, { status: 404 }),
      conflict: (message = "Conflict") => NextResponse.json({ error: message }, { status: 409 }),
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/tasks/queue-action-service", () => ({
  AiAgentQueueActionService: class {
    previewAction = previewAction;
    executeAction = executeAction;
  },
}));

describe("POST /api/admin/ai/agent/tasks/[id]/actions", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    previewAction.mockReset();
    executeAction.mockReset();
  });

  it("returns guarded preview payload for admins", async () => {
    previewAction.mockResolvedValue({
      mode: "guarded_preview",
      taskId: "task-1",
      action: "retry_task",
      actionPreview: {
        action: "retry_task",
        enabled: false,
        reason: "Retry is only allowed for FAILED rows.",
        statusTransition: { from: "PENDING", to: "PENDING" },
        payload: { task_id: "task-1" },
      },
      message: "Queue mutation is still guarded in this slice; preview only.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/tasks/task-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "retry_task", mode: "preview" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(previewAction).toHaveBeenCalledWith({
      taskId: "task-1",
      action: "retry_task",
    });
  });

  it("rejects non-admin callers", async () => {
    isAdmin.mockResolvedValue(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/tasks/task-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "retry_task", mode: "preview" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) } as any,
    );

    expect(response.status).toBe(403);
  });

  it("validates supported actions", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/tasks/task-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "delete_forever", mode: "preview" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) } as any,
    );

    expect(response.status).toBe(400);
  });

  it("executes a supported action for admins", async () => {
    executeAction.mockResolvedValue({
      mode: "executed",
      taskId: "task-1",
      action: "mark_dead",
      actionPreview: {
        action: "mark_dead",
        enabled: true,
        reason: "Mark dead would terminally skip the row and remove it from runnable queue states.",
        statusTransition: { from: "FAILED", to: "SKIPPED" },
        payload: {
          task_id: "task-1",
          preserve_result_metadata: false,
          terminal_reason: "admin_marked_dead",
        },
      },
      previousStatus: "FAILED",
      updatedTask: {
        id: "task-1",
        personaId: "persona-1",
        personaUsername: "ai_orchid",
        personaDisplayName: "Orchid",
        taskType: "comment",
        dispatchKind: "public",
        sourceTable: "comments",
        sourceId: "comment-1",
        dedupeKey: "ai_orchid:comment-1:comment",
        cooldownUntil: null,
        payload: { source: "public-comment" },
        status: "SKIPPED",
        scheduledAt: "2026-03-29T01:03:00.000Z",
        startedAt: null,
        completedAt: "2026-03-29T02:00:00.000Z",
        retryCount: 1,
        maxRetries: 3,
        leaseOwner: null,
        leaseUntil: null,
        resultId: null,
        resultType: null,
        errorMessage: "admin_marked_dead",
        createdAt: "2026-03-29T01:02:00.000Z",
      },
      message: "mark_dead executed against persona_tasks.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/tasks/task-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "mark_dead", mode: "execute" }),
      }),
      { params: Promise.resolve({ id: "task-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(executeAction).toHaveBeenCalledWith({
      taskId: "task-1",
      action: "mark_dead",
    });
  });
});
