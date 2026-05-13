import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, executeAdminPublicCandidateBatch } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  executeAdminPublicCandidateBatch: vi.fn(),
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

vi.mock("@/lib/ai/agent/intake/opportunity-pipeline-service", () => ({
  AiAgentOpportunityPipelineService: class {
    executeAdminPublicCandidateBatch = executeAdminPublicCandidateBatch;
  },
}));

describe("POST /api/admin/ai/agent/lab/candidates/public", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    executeAdminPublicCandidateBatch.mockReset();
  });

  it("runs one public candidate batch and returns explicit task outcomes", async () => {
    executeAdminPublicCandidateBatch.mockResolvedValue({
      taskResponse: {
        mode: "executed",
        kind: "public",
        message: "Inserted 1 persona_tasks rows for public intake.",
        injectionPreview: {
          rpcName: "inject_persona_tasks",
          summary: {
            candidateCount: 1,
            insertedCount: 1,
            skippedCount: 0,
            insertedTaskIds: ["task-1"],
            skippedReasonCounts: {},
          },
          results: [],
        },
        insertedTasks: [],
      },
      resolvedRows: [],
      taskOutcomes: [
        {
          opportunityId: "opp-1",
          personaId: "persona-1",
          inserted: true,
          taskId: "task-1",
          skipReason: null,
          status: "PENDING",
          errorMessage: null,
        },
      ],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/candidates/public", {
        method: "POST",
        body: JSON.stringify({
          opportunityIds: ["opp-1"],
          groupIndex: 2,
          batchSize: 10,
        }),
      }),
      {} as any,
    );

    expect(response.status).toBe(200);
    expect(executeAdminPublicCandidateBatch).toHaveBeenCalledWith({
      opportunityIds: ["opp-1"],
      groupIndex: 2,
      batchSize: 10,
    });
    await expect(response.json()).resolves.toMatchObject({
      taskOutcomes: [
        {
          opportunityId: "opp-1",
          personaId: "persona-1",
          inserted: true,
          taskId: "task-1",
        },
      ],
    });
  });
});
