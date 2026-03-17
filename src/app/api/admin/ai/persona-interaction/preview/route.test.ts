import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";

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
      rawResponse: '{"markdown":"reply","need_image":false,"image_prompt":null,"image_alt":null}',
      renderOk: true,
      renderError: null,
      tokenBudget: {
        estimatedInputTokens: 123,
        maxInputTokens: 3200,
        maxOutputTokens: 900,
        blockStats: [],
        compressedStages: ["memory"],
        exceeded: false,
        message: null,
      },
      auditDiagnostics: {
        status: "passed",
        issues: [],
        repairGuidance: [],
        severity: "low",
        confidence: 0.95,
        missingSignals: [],
        repairApplied: false,
        auditMode: "default",
        compactRetryUsed: false,
      },
    });
  });

  it("returns 400 for invalid taskType", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({ personaId: "p1", modelId: "m1", taskType: "reply" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(400);
  });

  it("passes structured vote target context through to the store", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "vote",
        taskContext: "Decide whether this target deserves an upvote.",
        targetContext: {
          targetType: "post",
          targetId: "post-1",
          targetAuthor: "artist_1",
          targetContent: "I tried three compositions and the last one feels strongest.",
          threadSummary: "Critique thread about composition choices.",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(previewPersonaInteraction).toHaveBeenCalledWith({
      personaId: "p1",
      modelId: "m1",
      taskType: "vote",
      taskContext: "Decide whether this target deserves an upvote.",
      targetContext: {
        targetType: "post",
        targetId: "post-1",
        targetAuthor: "artist_1",
        targetContent: "I tried three compositions and the last one feels strongest.",
        threadSummary: "Critique thread about composition choices.",
      },
      boardContext: undefined,
    });
  });

  it("passes structured poll target context through to the store", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "poll_vote",
        taskContext: "Choose one option.",
        targetContext: {
          pollPostId: "poll-1",
          pollQuestion: "Which palette works best?",
          pollOptions: [
            { id: "opt-1", label: "Warm" },
            { id: "opt-2", label: "Cool" },
          ],
          threadSummary: "Users are split between warm and cool palettes.",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(previewPersonaInteraction).toHaveBeenCalledWith({
      personaId: "p1",
      modelId: "m1",
      taskType: "poll_vote",
      taskContext: "Choose one option.",
      targetContext: {
        pollPostId: "poll-1",
        pollQuestion: "Which palette works best?",
        pollOptions: [
          { id: "opt-1", label: "Warm" },
          { id: "opt-2", label: "Cool" },
        ],
        threadSummary: "Users are split between warm and cool palettes.",
      },
      boardContext: undefined,
    });
  });

  it("still accepts board context for markdown actions", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "comment",
        taskContext: "hello",
        boardContext: {
          name: "Illustration",
          description: "Feedback for visual drafts",
          rules: [{ title: "Be specific", description: "Actionable critique only" }],
        },
        targetContext: {
          targetType: "comment",
          targetId: "comment-9",
          targetAuthor: "critic_2",
          targetContent: "Push the contrast further in the focal area.",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(previewPersonaInteraction).toHaveBeenCalledWith({
      personaId: "p1",
      modelId: "m1",
      taskType: "comment",
      taskContext: "hello",
      boardContext: {
        name: "Illustration",
        description: "Feedback for visual drafts",
        rules: [{ title: "Be specific", description: "Actionable critique only" }],
      },
      targetContext: {
        targetType: "comment",
        targetId: "comment-9",
        targetAuthor: "critic_2",
        targetContent: "Push the contrast further in the focal area.",
      },
    });
  });

  it("returns 422 with explicit persona audit failure details", async () => {
    previewPersonaInteraction.mockRejectedValueOnce(
      new PersonaOutputValidationError({
        code: "persona_repair_failed",
        message: "Repaired output still failed persona audit.",
        issues: ["persona priorities not visible"],
        repairGuidance: ["Make the persona's priorities visible in what it defends."],
        severity: "high",
        confidence: 0.91,
        missingSignals: ["persona priorities"],
      }),
    );

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
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe("Repaired output still failed persona audit.");
    expect(data.code).toBe("persona_repair_failed");
    expect(data.issues).toEqual(["persona priorities not visible"]);
    expect(data.repairGuidance).toEqual([
      "Make the persona's priorities visible in what it defends.",
    ]);
    expect(data.severity).toBe("high");
    expect(data.confidence).toBe(0.91);
    expect(data.missingSignals).toEqual(["persona priorities"]);
  });
});
