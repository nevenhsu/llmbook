import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";

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
    });
  });

  it("accepts reply taskType", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({ personaId: "p1", modelId: "m1", taskType: "reply" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);
    expect(previewPersonaInteraction).toHaveBeenCalledWith({
      personaId: "p1",
      modelId: "m1",
      taskType: "reply",
      taskContext: "",
      boardContext: undefined,
      targetContext: undefined,
    });
  });

  it("routes post structuredContext into targetContextText with empty taskContext", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "post",
        structuredContext: {
          taskType: "post",
          titleDirection: "Tentacles and Madness: A Cthulhu Mythos Worldbuilding Guide",
          contentDirection:
            "Explore the key elements of Lovecraftian horror in worldbuilding, focusing on the design of creatures that evoke cosmic dread, the role of forbidden knowledge, and how to create environments that feel ancient and unknowable.",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);

    const callArg = previewPersonaInteraction.mock.calls[0][0];
    expect(callArg.targetContextText).toBe(
      [
        "Title direction: Tentacles and Madness: A Cthulhu Mythos Worldbuilding Guide",
        "Content direction: Explore the key elements of Lovecraftian horror in worldbuilding, focusing on the design of creatures that evoke cosmic dread, the role of forbidden knowledge, and how to create environments that feel ancient and unknowable.",
      ].join("\n"),
    );
    expect(callArg.taskContext).toBe("");
  });

  it("routes comment structuredContext into targetContextText with empty taskContext", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "comment",
        structuredContext: {
          taskType: "comment",
          articleTitle: "On Cosmic Horror",
          articleOutline: "A discussion about cosmic horror themes.",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);

    const callArg = previewPersonaInteraction.mock.calls[0][0];
    expect(callArg.targetContextText).toBe(
      "Article: On Cosmic Horror\nOutline: A discussion about cosmic horror themes.",
    );
    expect(callArg.taskContext).toBe("");
  });

  it("routes reply structuredContext into targetContextText with empty taskContext", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "reply",
        structuredContext: {
          taskType: "reply",
          articleOutline: "A discussion about cosmic horror.",
          comments: [
            { content: "First comment." },
            { content: "Second comment." },
            { content: "Third comment." },
          ],
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);

    const callArg = previewPersonaInteraction.mock.calls[0][0];
    expect(callArg.targetContextText).toBe(
      [
        "Outline: A discussion about cosmic horror.",
        "",
        "Comments:",
        "1. First comment.",
        "2. Second comment.",
        "3. Third comment.",
      ].join("\n"),
    );
    expect(callArg.taskContext).toBe("");
  });

  it("routes manual taskContext as targetContextText for user-facing preview flows", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({
        personaId: "p1",
        modelId: "m1",
        taskType: "comment",
        taskContext: "Write about cosmic insignificance.",
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    expect(res.status).toBe(200);

    const callArg = previewPersonaInteraction.mock.calls[0][0];
    expect(callArg.targetContextText).toBe("Write about cosmic insignificance.");
    expect(callArg.taskContext).toBe("");
  });

  it("keeps vote taskContext on the legacy path", async () => {
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

  it("rejects internal post stage task types", async () => {
    const req = new Request("http://localhost/api/admin/ai/persona-interaction/preview", {
      method: "POST",
      body: JSON.stringify({ personaId: "p1", modelId: "m1", taskType: "post_body" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as any, { params: Promise.resolve({}) } as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("post, comment, reply, vote, poll_post, or poll_vote");
    expect(previewPersonaInteraction).not.toHaveBeenCalled();
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

  it("passes board context and targetContext alongside targetContextText for user-facing flows", async () => {
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
    expect(previewPersonaInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: "p1",
        modelId: "m1",
        taskType: "comment",
        targetContextText: "hello",
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
    );
    expect(previewPersonaInteraction.mock.calls[0][0].taskContext).toBe("");
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
