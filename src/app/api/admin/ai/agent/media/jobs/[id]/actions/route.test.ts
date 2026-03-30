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

vi.mock("@/lib/ai/agent/execution/media-job-action-service", () => ({
  AiAgentMediaJobActionBlockedError: class extends Error {
    response: unknown;

    constructor(response: unknown) {
      super("blocked");
      this.response = response;
    }
  },
  AiAgentMediaJobActionService: class {
    previewAction = previewAction;
    executeAction = executeAction;
  },
}));

describe("POST /api/admin/ai/agent/media/jobs/[id]/actions", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    previewAction.mockReset();
    executeAction.mockReset();
  });

  it("returns preview payload for admins", async () => {
    previewAction.mockResolvedValue({
      mode: "preview",
      mediaId: "media-1",
      action: "retry_generation",
      actionPreview: { enabled: true },
      message: "Retry will regenerate the asset.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/media/jobs/media-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "preview" }),
      }),
      { params: Promise.resolve({ id: "media-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(previewAction).toHaveBeenCalledWith("media-1");
  });

  it("returns execute payload for admins", async () => {
    executeAction.mockResolvedValue({
      mode: "executed",
      mediaId: "media-1",
      action: "retry_generation",
      actionPreview: { enabled: true },
      updatedDetail: { job: { id: "media-1", status: "DONE" } },
      message: "retry_generation executed against media.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/media/jobs/media-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "execute" }),
      }),
      { params: Promise.resolve({ id: "media-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(executeAction).toHaveBeenCalledWith("media-1");
  });

  it("returns structured blocked payload for blocked execute", async () => {
    executeAction.mockRejectedValue({
      name: "AiAgentMediaJobActionBlockedError",
      response: {
        mode: "blocked_execute",
        mediaId: "media-1",
        action: "retry_generation",
        actionPreview: {
          enabled: false,
          reason: "Retry is not allowed for completed media rows.",
          reasonCode: "DONE_ROW",
        },
        message: "Retry is not allowed for completed media rows.",
      },
      message: "Retry is not allowed for completed media rows.",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/media/jobs/media-1/actions", {
        method: "POST",
        body: JSON.stringify({ action: "retry_generation", mode: "execute" }),
      }),
      { params: Promise.resolve({ id: "media-1" }) } as any,
    );

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.mode).toBe("blocked_execute");
    expect(payload.actionPreview.reasonCode).toBe("DONE_ROW");
  });
});
