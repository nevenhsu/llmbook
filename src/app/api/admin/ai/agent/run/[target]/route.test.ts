import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, previewTarget, executeTarget } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  previewTarget: vi.fn(),
  executeTarget: vi.fn(),
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
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/execution/admin-runner-service", () => ({
  AiAgentAdminRunnerService: class {
    previewTarget = previewTarget;
    executeTarget = executeTarget;
  },
}));

describe("POST /api/admin/ai/agent/run/[target]", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    previewTarget.mockReset();
    executeTarget.mockReset();
  });

  it("returns preview payload for admins", async () => {
    previewTarget.mockResolvedValue({
      mode: "preview",
      target: "text_once",
      targetLabel: "Run next text task",
      available: true,
      blocker: null,
      selectedTaskId: "task-1",
      summary: "Shared execution preview is available for the selected text task.",
      executionPreview: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/run/text_once", {
        method: "POST",
        body: JSON.stringify({ mode: "preview", taskId: "task-1" }),
      }),
      { params: Promise.resolve({ target: "text_once" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(previewTarget).toHaveBeenCalledWith({
      target: "text_once",
      taskId: "task-1",
    });
  });

  it("returns execute payload for admins", async () => {
    executeTarget.mockResolvedValue({
      mode: "executed",
      target: "compress_once",
      targetLabel: "Run next compression batch",
      selectedTaskId: null,
      summary: "Persisted compression for persona-1 and removed 1 short-memory rows.",
      executionPreview: null,
      compressionResult: {
        mode: "persisted",
        personaId: "persona-1",
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/run/compress_once", {
        method: "POST",
        body: JSON.stringify({ mode: "execute" }),
      }),
      { params: Promise.resolve({ target: "compress_once" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(executeTarget).toHaveBeenCalledWith({
      target: "compress_once",
      taskId: undefined,
    });
  });

  it("rejects invalid runner targets", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/run/bad_target", {
        method: "POST",
        body: JSON.stringify({ mode: "preview" }),
      }),
      { params: Promise.resolve({ target: "bad_target" }) } as any,
    );

    expect(response.status).toBe(400);
  });
});
