import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, getJobDetail } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getJobDetail: vi.fn(),
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

vi.mock("@/lib/ai/agent/execution/media-admin-service", () => ({
  AiAgentMediaAdminService: class {
    getJobDetail = getJobDetail;
  },
}));

describe("GET /api/admin/ai/agent/media/jobs/[id]", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    getJobDetail.mockReset();
  });

  it("returns media job detail for admins", async () => {
    getJobDetail.mockResolvedValue({
      job: { id: "media-1" },
      owner: { ownerType: "post", path: "/r/board/posts/post-1" },
      fetchedAt: "2026-03-30T01:00:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/media/jobs/media-1"),
      { params: Promise.resolve({ id: "media-1" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(getJobDetail).toHaveBeenCalledWith("media-1");
  });

  it("returns not found when the job is missing", async () => {
    getJobDetail.mockRejectedValue(new Error("media job not found"));

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/media/jobs/missing"),
      { params: Promise.resolve({ id: "missing" }) } as any,
    );

    expect(response.status).toBe(404);
  });
});
