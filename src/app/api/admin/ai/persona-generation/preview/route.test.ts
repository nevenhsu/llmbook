import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
} from "@/lib/ai/admin/control-plane-store";

const { isAdmin, previewPersonaGeneration } = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  previewPersonaGeneration: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({
  isAdmin,
}));

vi.mock("@/lib/ai/admin/control-plane-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/admin/control-plane-store")>(
    "@/lib/ai/admin/control-plane-store",
  );
  return {
    ...actual,
    AdminAiControlPlaneStore: class {
      previewPersonaGeneration = previewPersonaGeneration;
    },
  };
});

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

describe("POST /api/admin/ai/persona-generation/preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin.mockResolvedValue(true);
  });

  it("returns raw output when persona generation JSON parsing fails", async () => {
    previewPersonaGeneration.mockRejectedValue(
      new PersonaGenerationParseError(
        "persona generation output must be valid JSON",
        "Name: sharp critic\nBio: hates fluff",
        {
          stageName: "persona_core",
          details: {
            attemptStage: "attempt-3",
            finishReason: "length",
            providerId: "minimax",
            modelId: "MiniMax-M2.5",
            hadText: true,
            attempts: 1,
            usedFallback: false,
          },
        },
      ),
    );

    const req = new Request("http://localhost/api/admin/ai/persona-generation/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", extraPrompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "persona generation output must be valid JSON",
      stageName: "persona_core",
      result: "Name: sharp critic\nBio: hates fluff",
      details: {
        attemptStage: "attempt-3",
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
        hadText: true,
        attempts: 1,
        usedFallback: false,
      },
    });
  });

  it("returns 422 with raw output when persona generation schema validation fails", async () => {
    previewPersonaGeneration.mockRejectedValue(
      new PersonaGenerationParseError(
        "persona generation output missing persona_core.values",
        '{"persona":{"display_name":"AI Critic","bio":"Sharp but fair.","status":"active"},"persona_core":{"identity_summary":{"archetype":"critic"}}}',
      ),
    );

    const req = new Request("http://localhost/api/admin/ai/persona-generation/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", extraPrompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "persona generation output missing persona_core.values",
      result:
        '{"persona":{"display_name":"AI Critic","bio":"Sharp but fair.","status":"active"},"persona_core":{"identity_summary":{"archetype":"critic"}}}',
    });
  });

  it("returns stage-specific details when persona generation quality repair fails", async () => {
    previewPersonaGeneration.mockRejectedValue(
      new PersonaGenerationQualityError({
        stageName: "persona_core",
        message: "persona generation stage persona_core quality repair failed",
        rawOutput: '{"interaction_defaults":{"default_stance":"impulsive_challenge"}}',
        issues: [
          "interaction_defaults.default_stance must be a natural-language description, not an identifier-style label.",
        ],
        details: {
          attemptStage: "quality-repair-2",
          finishReason: "length",
          providerId: "minimax",
          modelId: "MiniMax-M2.5",
          hadText: true,
          attempts: 1,
          usedFallback: false,
        },
      }),
    );

    const req = new Request("http://localhost/api/admin/ai/persona-generation/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", extraPrompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "persona generation stage persona_core quality repair failed",
      code: "persona_generation_stage_quality_failed",
      stageName: "persona_core",
      issues: [
        "interaction_defaults.default_stance must be a natural-language description, not an identifier-style label.",
      ],
      result: '{"interaction_defaults":{"default_stance":"impulsive_challenge"}}',
      details: {
        attemptStage: "quality-repair-2",
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
        hadText: true,
        attempts: 1,
        usedFallback: false,
      },
    });
  });

  it("keeps the preview error payload shape stable even for uncategorized generate failures", async () => {
    previewPersonaGeneration.mockRejectedValue(new Error("provider request failed"));

    const req = new Request("http://localhost/api/admin/ai/persona-generation/preview", {
      method: "POST",
      body: JSON.stringify({ modelId: "model-1", extraPrompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "provider request failed",
      result: null,
    });
  });
});
