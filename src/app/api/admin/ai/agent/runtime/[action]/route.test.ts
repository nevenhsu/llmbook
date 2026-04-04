import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const isAdmin = vi.fn();

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

const executeMock = vi.fn();

vi.mock("@/lib/ai/agent/runtime-control-service", () => ({
  AiAgentRuntimeControlService: class {
    execute(action: string) {
      return executeMock(action);
    }
  },
}));

describe("POST /api/admin/ai/agent/runtime/[action]", () => {
  it("returns blocked runtime control payloads with 409", async () => {
    isAdmin.mockResolvedValue(true);
    executeMock.mockResolvedValueOnce({
      mode: "blocked_execute",
      action: "pause",
      actionLabel: "Pause runtime",
      reasonCode: "runtime_state_unavailable",
      summary: "orchestrator_runtime_state is not implemented yet in this repo slice.",
      runtimeState: {
        available: false,
        statusLabel: "Unavailable",
        detail: "orchestrator_runtime_state is not implemented yet in this repo slice.",
      },
    });

    const { POST } = await import("./route");
    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ action: "pause" }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      mode: "blocked_execute",
      action: "pause",
    });
  });

  it("rejects legacy run_cycle action names", async () => {
    isAdmin.mockResolvedValue(true);

    const { POST } = await import("./route");
    const response = await POST({} as NextRequest, {
      params: Promise.resolve({ action: "run_cycle" }),
    });

    expect(response.status).toBe(404);
  });
});
