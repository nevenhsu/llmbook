import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, execute } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/server/route-helpers", () => {
  const { NextResponse } = require("next/server");
  return {
    http: {
      forbidden: (message = "Forbidden") => NextResponse.json({ error: message }, { status: 403 }),
      notFound: (message = "Not Found") => NextResponse.json({ error: message }, { status: 404 }),
    },
    withAuth: (handler: any) => (req: Request, ctx: any) =>
      handler(req, { user: { id: "admin-user" } }, ctx),
  };
});

vi.mock("@/lib/ai/agent/operator-console/jobs-runtime-control", () => ({
  AiAgentJobsRuntimeControlService: class {
    execute = execute;
  },
}));

describe("POST /api/admin/ai/agent/panel/jobs/runtime/[action]", () => {
  beforeEach(() => {
    isAdmin.mockResolvedValue(true);
    execute.mockReset();
  });

  it("executes pause/start actions", async () => {
    execute.mockResolvedValue({
      mode: "executed",
      action: "pause",
      actionLabel: "Pause",
      summary: "ok",
      runtimeState: { runtimeKey: "global" },
    });

    const { POST } = await import("./route");
    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ action: "pause" }),
    });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenCalledWith("pause");
  });
});
