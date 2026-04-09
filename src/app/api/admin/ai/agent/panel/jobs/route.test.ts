import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, list, enqueue } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  list: vi.fn(),
  enqueue: vi.fn(),
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
      created: (data: unknown) => NextResponse.json(data, { status: 201 }),
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    parseJsonBody: async (req: Request) => req.json(),
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/operator-console/job-list-read-model", () => ({
  AiAgentJobListReadModel: class {
    list = list;
  },
}));

vi.mock("@/lib/ai/agent/operator-console/job-enqueue-service", () => ({
  AiAgentJobEnqueueService: class {
    enqueue = enqueue;
  },
}));

describe("/api/admin/ai/agent/panel/jobs", () => {
  beforeEach(() => {
    isAdmin.mockResolvedValue(true);
    list.mockReset();
    enqueue.mockReset();
  });

  it("lists paginated jobs for admins", async () => {
    list.mockResolvedValue({
      rows: [],
      runtimeState: { runtimeKey: "global" },
      summary: { active: 0, terminal: 0, total: 0 },
      page: 2,
      pageSize: 10,
      totalItems: 0,
      totalPages: 1,
      fetchedAt: "2026-04-08T12:00:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/panel/jobs?page=2&pageSize=10"),
      {} as any,
    );

    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });

  it("enqueues a job for admins", async () => {
    enqueue.mockResolvedValue({
      mode: "enqueued",
      task: { id: "job-1", status: "PENDING" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/ai/agent/panel/jobs", {
        method: "POST",
        body: JSON.stringify({
          jobType: "public_task",
          subjectId: "task-1",
        }),
      }),
      {} as any,
    );

    expect(response.status).toBe(201);
    expect(enqueue).toHaveBeenCalledWith({
      jobType: "public_task",
      subjectId: "task-1",
      requestedBy: "admin-user",
    });
  });
});
