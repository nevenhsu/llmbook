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
  withAdminAuth: (handler: any) => async (req: Request, routeContext?: any) => {
    const user = { id: "user-1" };
    if (!(await isAdmin(user.id))) {
      return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }
    return handler(req, { user, supabase: {} }, routeContext ?? { params: Promise.resolve({}) });
  },
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { POST } from "./route";

const mockOutput = {
  taskType: "comment" as const,
  articleTitle: "The Art of Gesture Critique",
  articleOutline: "Explore silhouette contrast techniques.",
};

describe("POST /api/admin/ai/persona-interaction/context-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    assistInteractionTaskContext.mockResolvedValue(mockOutput);
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

  it("returns structured output without personaId", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/context-assist", {
      method: "POST",
      body: JSON.stringify({
        modelId: "model-1",
        taskType: "comment",
        targetContextText: "Current draft asks for sharper critique on gesture and silhouette.",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockOutput);
    expect(assistInteractionTaskContext).toHaveBeenCalledWith({
      modelId: "model-1",
      taskType: "comment",
      targetContextText: "Current draft asks for sharper critique on gesture and silhouette.",
    });
  });

  it("does not pass personaId to the store", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/context-assist", {
      method: "POST",
      body: JSON.stringify({
        modelId: "model-1",
        taskType: "post",
        personaId: "persona-1",
        targetContextText: "Some context",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);

    const callArg = assistInteractionTaskContext.mock.calls[0]?.[0];
    expect(callArg).not.toHaveProperty("personaId");
    expect(callArg).toEqual({
      modelId: "model-1",
      taskType: "post",
      targetContextText: "Some context",
    });
  });
});
