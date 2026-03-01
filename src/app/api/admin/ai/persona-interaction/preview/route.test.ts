import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, previewPersonaInteraction } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  previewPersonaInteraction: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    previewPersonaInteraction = previewPersonaInteraction;
  },
}));

vi.mock("@/lib/server/route-helpers", () => ({
  withAuth: (handler: any) => (req: Request) =>
    handler(req, { user: { id: "admin-1" }, supabase: {} }, { params: Promise.resolve({}) }),
  http: {
    ok: (data: unknown) => Response.json(data, { status: 200 }),
    badRequest: (message = "Bad request") => Response.json({ error: message }, { status: 400 }),
    forbidden: (message = "Forbidden") => Response.json({ error: message }, { status: 403 }),
  },
}));

import { POST } from "./route";

describe("POST /api/admin/ai/persona-interaction/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    previewPersonaInteraction.mockResolvedValue({
      assembledPrompt: "prompt",
      markdown: "reply",
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 123,
        maxInputTokens: 3200,
        maxOutputTokens: 900,
        blockStats: [],
        compressedStages: ["persona_memory"],
        exceeded: false,
        message: null,
      },
    });
  });

  it("returns 400 for invalid taskType", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({ personaId: "p1", modelId: "m1", taskType: "vote" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it("returns preview for valid payload", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "comment",
        taskContext: "hello",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preview.tokenBudget.compressedStages).toEqual(["persona_memory"]);
    expect(previewPersonaInteraction).toHaveBeenCalledWith({
      personaId: "p1",
      modelId: "m1",
      taskType: "comment",
      taskContext: "hello",
      soulOverride: undefined,
      longMemoryOverride: undefined,
    });
  });
});
