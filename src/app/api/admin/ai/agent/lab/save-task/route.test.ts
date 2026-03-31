import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, executeCandidates } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  executeCandidates: vi.fn(),
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
    parseJsonBody: async (req: Request) => req.json(),
  };
});

vi.mock("@/lib/ai/agent/intake/task-injection-service", () => ({
  AiAgentTaskInjectionService: class {
    executeCandidates = executeCandidates;
  },
}));

describe("POST /api/admin/ai/agent/lab/save-task", () => {
  beforeEach(() => {
    vi.resetModules();
    isAdmin.mockResolvedValue(true);
    executeCandidates.mockReset();
  });

  it("executes a single-candidate save for admins", async () => {
    executeCandidates.mockResolvedValue({
      mode: "executed",
      message: "Inserted 1 persona_tasks row.",
      injectionPreview: {
        results: [{ candidateIndex: 3, inserted: true, skipReason: null, taskId: "task-1" }],
      },
      insertedTasks: [{ id: "task-1" }],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/save-task", {
        method: "POST",
        body: JSON.stringify({
          candidate: {
            candidateIndex: 3,
            personaId: "persona-orchid",
          },
        }),
      }),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(200);
    expect(executeCandidates).toHaveBeenCalledWith({
      candidates: [{ candidateIndex: 3, personaId: "persona-orchid" }],
    });
  });

  it("rejects missing candidates", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/lab/save-task", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({}) } as any,
    );

    expect(response.status).toBe(400);
  });
});
