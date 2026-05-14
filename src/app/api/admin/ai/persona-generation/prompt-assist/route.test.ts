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
  withAdminAuth: (handler: any) => async (req: Request, routeContext?: any) => {
    const user = { id: "user-1" };
    if (!(await isAdmin(user.id))) {
      return Response.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }
    return handler(req, { user, supabase: {} }, routeContext ?? { params: Promise.resolve({}) });
  },
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
    assistPersonaPrompt.mockResolvedValue({
      text: "Prompt text",
      referenceNames: ["Ada Lovelace"],
      debugRecords: [],
    });
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

  it("returns assisted prompt text with referenceNames and debugRecords", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "hello" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      text: "Prompt text",
      referenceNames: ["Ada Lovelace"],
      debugRecords: [],
    });
    expect(assistPersonaPrompt).toHaveBeenCalledWith({
      modelId: "model-1",
      inputPrompt: "hello",
    });
  });

  it("surfaces prompt-assist failures with error, rawText, and debugRecords", async () => {
    assistPersonaPrompt.mockResolvedValue({
      error: "prompt assist output text is empty",
      rawText: null,
      debugRecords: [
        {
          name: "prompt_assist",
          displayPrompt: "mock prompt",
          outputMaxTokens: 1024,
          attempts: [],
        },
      ],
    });

    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "three body" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "prompt assist output text is empty",
      rawText: null,
      debugRecords: [
        {
          name: "prompt_assist",
          displayPrompt: "mock prompt",
          outputMaxTokens: 1024,
          attempts: [],
        },
      ],
    });
  });

  it("returns failure when the llm output has no reference names", async () => {
    assistPersonaPrompt.mockResolvedValue({
      error: "prompt assist output must include at least one reference name",
      rawText: "A globe-trotting storyteller who turns every meal into a social map.",
      debugRecords: [
        {
          name: "prompt_assist",
          displayPrompt: "mock prompt",
          outputMaxTokens: 1024,
          attempts: [
            {
              attempt: "main",
              text: "A globe-trotting storyteller who turns every meal into a social map.",
              finishReason: "stop",
              providerId: "minimax",
              modelId: "MiniMax-M2.5",
              hadError: false,
            },
          ],
        },
      ],
    });

    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "Roland Barthes" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "prompt assist output must include at least one reference name",
      rawText: "A globe-trotting storyteller who turns every meal into a social map.",
      debugRecords: [
        {
          name: "prompt_assist",
          displayPrompt: "mock prompt",
          outputMaxTokens: 1024,
          attempts: [
            {
              attempt: "main",
              text: "A globe-trotting storyteller who turns every meal into a social map.",
              finishReason: "stop",
              providerId: "minimax",
              modelId: "MiniMax-M2.5",
              hadError: false,
            },
          ],
        },
      ],
    });
  });
});
