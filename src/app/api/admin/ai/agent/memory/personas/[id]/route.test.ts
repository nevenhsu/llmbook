import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, getPersonaPreview } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getPersonaPreview: vi.fn(),
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
    withAdminAuth: (handler: any) => async (req: Request, routeContext?: any) => {
      const user = { id: "user-1" };
      if (!(await isAdmin(user.id))) {
        return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
      }
      return handler(req, { user, supabase: {} }, routeContext ?? { params: Promise.resolve({}) });
    },
  };
});

vi.mock("@/lib/ai/agent/memory", () => ({
  AiAgentMemoryAdminService: class {
    getPersonaPreview = getPersonaPreview;
  },
}));

describe("GET /api/admin/ai/agent/memory/personas/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    getPersonaPreview.mockReset();
  });

  it("returns persona preview for admins", async () => {
    getPersonaPreview.mockResolvedValue({
      persona: { personaId: "persona-1", username: "ai_orchid" },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/memory/personas/persona-1"),
      { params: Promise.resolve({ id: "persona-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(getPersonaPreview).toHaveBeenCalledWith("persona-1");
  });
});
