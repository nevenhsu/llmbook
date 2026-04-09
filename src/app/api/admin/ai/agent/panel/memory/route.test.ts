import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, list } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  list: vi.fn(),
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

vi.mock("@/lib/ai/agent/operator-console/memory-table-read-model", () => ({
  AiAgentMemoryTableReadModel: class {
    list = list;
  },
}));

describe("GET /api/admin/ai/agent/panel/memory", () => {
  beforeEach(() => {
    isAdmin.mockResolvedValue(true);
    list.mockReset();
  });

  it("lists persona memory summaries", async () => {
    list.mockResolvedValue({
      rows: [],
      summary: { total: 0 },
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 1,
      fetchedAt: "2026-04-08T12:00:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/panel/memory?page=1&pageSize=10"),
      {} as any,
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
  });
});
