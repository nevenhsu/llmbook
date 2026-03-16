import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, assistInteractionTaskContext } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  assistInteractionTaskContext: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    assistInteractionTaskContext = assistInteractionTaskContext;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { POST } from "./route";

describe("POST /api/admin/ai/persona-interaction/context-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    assistInteractionTaskContext.mockResolvedValue("Mock interaction test content");
  });

  it("requires modelId", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/context-assist", {
      method: "POST",
      body: JSON.stringify({ taskType: "comment" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it("requires a supported taskType", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/context-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", taskType: "vote" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it("returns generated task-context text", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/context-assist", {
      method: "POST",
      body: JSON.stringify({
        modelId: "model-1",
        taskType: "comment",
        personaId: "persona-1",
        taskContext: "Current draft asks for sharper critique on gesture and silhouette.",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Mock interaction test content" });
    expect(assistInteractionTaskContext).toHaveBeenCalledWith({
      modelId: "model-1",
      taskType: "comment",
      personaId: "persona-1",
      taskContext: "Current draft asks for sharper critique on gesture and silhouette.",
    });
  });
});
