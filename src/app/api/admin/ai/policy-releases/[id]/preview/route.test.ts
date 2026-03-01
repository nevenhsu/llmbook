import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, previewGlobalPolicyRelease } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  previewGlobalPolicyRelease: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    previewGlobalPolicyRelease = previewGlobalPolicyRelease;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request, routeContext: { params: Promise<{ id: string }> }) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, routeContext),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { POST } from "./route";

describe("POST /api/admin/ai/policy-releases/:id/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    previewGlobalPolicyRelease.mockResolvedValue({
      assembledPrompt: "[system]",
      markdown: "hello",
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 100,
        maxInputTokens: 3200,
        maxOutputTokens: 900,
        blockStats: [{ name: "global_policy", tokens: 40 }],
        compressedStages: [],
        exceeded: false,
        message: null,
      },
    });
  });

  it("returns 403 for non-admin", async () => {
    isAdmin.mockResolvedValue(false);
    const req = new Request("http://localhost/api/admin/ai/policy-releases/10/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "m-1", taskContext: "test" }),
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: "10" }) } as any);
    expect(res.status).toBe(403);
  });

  it("returns preview payload", async () => {
    const req = new Request("http://localhost/api/admin/ai/policy-releases/10/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "m-1", taskContext: "test" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({ id: "10" }) } as any);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.preview.renderOk).toBe(true);
    expect(previewGlobalPolicyRelease).toHaveBeenCalledWith(10, "m-1", "test");
  });
});
