import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, assistPersonaPrompt } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  assistPersonaPrompt: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    assistPersonaPrompt = assistPersonaPrompt;
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

describe("POST /api/admin/ai/persona-generation/prompt-assist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
    assistPersonaPrompt.mockResolvedValue("Prompt text");
  });

  it("requires modelId", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ inputPrompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it("returns assisted prompt text", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "Prompt text" });
    expect(assistPersonaPrompt).toHaveBeenCalledWith({
      modelId: "model-1",
      inputPrompt: "hello",
    });
  });

  it("surfaces prompt-assist errors instead of fabricating fallback text", async () => {
    assistPersonaPrompt.mockRejectedValue(new Error("prompt assist returned empty output"));

    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "three body" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "prompt assist returned empty output" });
  });
});
