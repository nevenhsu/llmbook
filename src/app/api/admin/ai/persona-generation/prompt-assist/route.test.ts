import { beforeEach, describe, expect, it, vi } from "vitest";

const { isAdmin, assistPersonaPrompt, PromptAssistError } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  assistPersonaPrompt: vi.fn(),
  PromptAssistError: class PromptAssistError extends Error {
    code: string;
    details?: Record<string, unknown> | null;
    constructor(message: string, code: string, details?: Record<string, unknown> | null) {
      super(message);
      this.name = "PromptAssistError";
      this.code = code;
      this.details = details ?? null;
    }
  },
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", () => ({
  AdminAiControlPlaneStore: class {
    assistPersonaPrompt = assistPersonaPrompt;
  },
  PromptAssistError,
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
    assistPersonaPrompt.mockResolvedValue({ text: "Prompt text", referenceNames: [] });
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
    expect(await res.json()).toEqual({ text: "Prompt text", referenceNames: [] });
    expect(assistPersonaPrompt).toHaveBeenCalledWith({
      modelId: "model-1",
      inputPrompt: "hello",
    });
  });

  it("surfaces prompt-assist errors instead of fabricating fallback text", async () => {
    assistPersonaPrompt.mockRejectedValue(
      new PromptAssistError(
        "prompt assist repair returned empty output",
        "prompt_assist_repair_output_empty",
        {
          attemptStage: "empty_output_repair",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          finishReason: "length",
          hadText: false,
          rawText: null,
        },
      ),
    );

    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "three body" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "prompt assist repair returned empty output",
      code: "prompt_assist_repair_output_empty",
      rawText: null,
      details: {
        attemptStage: "empty_output_repair",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        finishReason: "length",
        hadText: false,
      },
    });
  });

  it("includes the failing llm output when prompt-assist validation rejects a non-empty result", async () => {
    assistPersonaPrompt.mockRejectedValue(
      new PromptAssistError(
        "prompt assist output must include at least 1 explicit personality-bearing named reference",
        "prompt_assist_missing_reference",
        {
          attemptStage: "main_rewrite",
          providerId: "minimax",
          modelId: "MiniMax-M2.5",
          finishReason: "stop",
          hadText: true,
          rawText: "A globe-trotting storyteller who turns every meal into a social map.",
        },
      ),
    );

    const req = new Request("http://localhost/api/admin/ai/persona-generation/prompt-assist", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", inputPrompt: "Roland Barthes" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error:
        "prompt assist output must include at least 1 explicit personality-bearing named reference",
      code: "prompt_assist_missing_reference",
      rawText: "A globe-trotting storyteller who turns every meal into a social map.",
      details: {
        attemptStage: "main_rewrite",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
        finishReason: "stop",
        hadText: true,
      },
    });
  });
});
