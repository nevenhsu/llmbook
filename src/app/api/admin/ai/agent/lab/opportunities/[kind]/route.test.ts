import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, scoreAdminOpportunityBatch } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  scoreAdminOpportunityBatch: vi.fn(),
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
  };
});

vi.mock("@/lib/ai/agent/intake/opportunity-pipeline-service", () => ({
  AiAgentOpportunityPipelineService: class {
    scoreAdminOpportunityBatch = scoreAdminOpportunityBatch;
  },
}));

describe("POST /api/admin/ai/agent/lab/opportunities/[kind]", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    scoreAdminOpportunityBatch.mockReset();
  });

  it("scores only the requested opportunity ids", async () => {
    scoreAdminOpportunityBatch.mockResolvedValue(undefined);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/opportunities/public", {
        method: "POST",
        body: JSON.stringify({
          opportunityIds: ["opp-1", "opp-2"],
        }),
      }),
      { params: Promise.resolve({ kind: "public" }) } as any,
    );

    expect(response.status).toBe(200);
    expect(scoreAdminOpportunityBatch).toHaveBeenCalledWith({
      kind: "public",
      opportunityIds: ["opp-1", "opp-2"],
    });
  });
});
