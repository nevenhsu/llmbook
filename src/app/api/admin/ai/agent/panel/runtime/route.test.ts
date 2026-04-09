import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, load } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  load: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/server/route-helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    http: {
      forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
      ok: (data: unknown) => NextResponse.json(data, { status: 200 }),
    },
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/operator-console/runtime-read-model", () => ({
  AiAgentOperatorRuntimeReadModel: class {
    load = load;
  },
}));

describe("GET /api/admin/ai/agent/panel/runtime", () => {
  beforeEach(() => {
    isAdmin.mockResolvedValue(true);
    load.mockReset();
  });

  it("returns the operator runtime payload for admins", async () => {
    load.mockResolvedValue({
      mainRuntime: { available: true },
      jobsRuntime: { runtimeKey: "global" },
      summary: {
        queueTasksAll: 10,
        publicTasks: 6,
        notificationTasks: 4,
        imageQueue: 3,
        jobsQueue: 2,
      },
      fetchedAt: "2026-04-08T12:00:00.000Z",
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/ai/agent/panel/runtime"),
      {} as any,
    );

    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalled();
  });
});
