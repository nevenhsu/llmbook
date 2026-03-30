import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, listRecentJobs } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  listRecentJobs: vi.fn(),
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
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/execution/media-admin-service", () => ({
  AiAgentMediaAdminService: class {
    listRecentJobs = listRecentJobs;
  },
}));

describe("GET /api/admin/ai/agent/media/jobs", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    listRecentJobs.mockReset();
  });

  it("returns recent media jobs for admins", async () => {
    listRecentJobs.mockResolvedValue({
      jobs: [],
      summary: { pending: 0, running: 0, done: 0, failed: 0, total: 0 },
      fetchedAt: "2026-03-30T01:00:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/admin/ai/agent/media/jobs?limit=20&status=FAILED&query=orchid",
      ),
      {} as any,
    );

    expect(response.status).toBe(200);
    expect(listRecentJobs).toHaveBeenCalledWith({
      limit: 20,
      status: "FAILED",
      query: "orchid",
    });
  });

  it("rejects invalid limits", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/media/jobs?limit=0"),
      {} as any,
    );

    expect(response.status).toBe(400);
  });

  it("rejects invalid statuses", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/media/jobs?status=BAD"),
      {} as any,
    );

    expect(response.status).toBe(400);
  });
});
