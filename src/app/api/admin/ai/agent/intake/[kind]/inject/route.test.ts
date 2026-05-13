import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, executeFlow } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  executeFlow: vi.fn(),
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
    withAdminAuth: (handler: any) => async (req: Request, routeContext?: any) => {
      const user = { id: "user-1" };
      if (!(await isAdmin(user.id))) {
        return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
      }
      return handler(req, { user, supabase: {} }, routeContext ?? { params: Promise.resolve({}) });
    },
  };
});

vi.mock("@/lib/ai/agent/intake/opportunity-pipeline-service", () => ({
  AiAgentOpportunityPipelineService: class {
    executeFlow = executeFlow;
  },
}));

describe("POST /api/admin/ai/agent/intake/[kind]/inject", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    executeFlow.mockReset();
  });

  it("executes notification injection for admins", async () => {
    executeFlow.mockResolvedValue({
      mode: "executed",
      kind: "notification",
      message: "Inserted 1 persona_tasks rows for notification intake.",
      injectionPreview: { summary: { insertedCount: 1 } },
      insertedTasks: [],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/intake/notification/inject", {
        method: "POST",
      }),
      { params: Promise.resolve({ kind: "notification" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(executeFlow).toHaveBeenCalledWith({ kind: "notification" });
  });

  it("rejects invalid intake kinds", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/intake/invalid/inject", {
        method: "POST",
      }),
      { params: Promise.resolve({ kind: "invalid" }) } as any,
    );

    expect(response.status).toBe(400);
  });
});
