import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, loadSnapshot } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  loadSnapshot: vi.fn(),
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
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    parseJsonBody: async <T>(req: Request): Promise<T> => req.json(),
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

vi.mock("@/lib/ai/agent/intake/admin-lab-source-service", () => ({
  AiAgentAdminLabSourceService: class {
    loadSnapshot = loadSnapshot;
  },
}));

describe("POST /api/admin/ai/agent/lab/source-mode/[kind]", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    loadSnapshot.mockReset();
  });

  it("loads admin lab source snapshots through the persisted ai_opps flow", async () => {
    loadSnapshot.mockResolvedValue({
      kind: "public",
      statusLabel: "ready",
      sourceNames: ["posts", "comments"],
      items: [],
      selectorInput: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/source-mode/public", {
        method: "POST",
        body: JSON.stringify({
          batchSize: 10,
          groupIndex: 2,
          score: true,
        }),
      }),
      { params: Promise.resolve({ kind: "public" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(loadSnapshot).toHaveBeenCalledWith({
      kind: "public",
      batchSize: 10,
      groupIndex: 2,
      score: true,
    });
  });

  it("rejects invalid kinds", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/source-mode/invalid", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ kind: "invalid" }) } as any,
    );

    expect(response.status).toBe(400);
  });

  it("rejects non-admin users", async () => {
    isAdmin.mockResolvedValue(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/source-mode/public", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ kind: "public" }) } as any,
    );

    expect(response.status).toBe(403);
    expect(loadSnapshot).not.toHaveBeenCalled();
  });
});
