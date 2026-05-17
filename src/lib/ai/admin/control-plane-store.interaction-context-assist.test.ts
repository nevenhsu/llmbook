import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore, type AiModelConfig } from "@/lib/ai/admin/control-plane-store";
import type { InteractionContextAssistOutput } from "@/lib/ai/admin/interaction-context-assist-schema";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig: vi.fn(async () => ({
    route: { targets: [{ providerId: "minimax", modelId: "MiniMax-M2.5" }] },
    timeoutMs: 12000,
    retries: 1,
  })),
}));

vi.mock("@/lib/ai/llm/invoke-structured-llm", () => ({
  invokeStructuredLLM: vi.fn(),
}));

function sampleModel(): AiModelConfig {
  return {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "MiniMax-M2.5",
    displayName: "MiniMax M2.5",
    capability: "text_generation",
    status: "active",
    testStatus: "success",
    lifecycleStatus: "active",
    displayOrder: 1,
    lastErrorKind: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    supportsInput: true,
    supportsImageInputPrompt: false,
    supportsOutput: true,
    contextWindow: 128000,
    maxOutputTokens: 8192,
    metadata: {},
    updatedAt: "2026-03-16T00:00:00.000Z",
  };
}

function mockActiveControlPlane(store: AdminAiControlPlaneStore) {
  vi.spyOn(store, "getActiveControlPlane").mockResolvedValue({
    release: null,
    document: {
      globalPolicyDraft: {
        systemBaseline: "baseline",
        globalPolicy: "policy",
        styleGuide: "style",
        forbiddenRules: "forbidden",
      },
    },
    providers: [
      {
        id: "provider-1",
        providerKey: "minimax",
        displayName: "MiniMax",
        sdkPackage: "@ai-sdk/minimax",
        status: "active",
        testStatus: "success",
        keyLast4: "1234",
        hasKey: true,
        lastApiErrorCode: null,
        lastApiErrorMessage: null,
        lastApiErrorAt: null,
        createdAt: "2026-03-16T00:00:00.000Z",
        updatedAt: "2026-03-16T00:00:00.000Z",
      },
    ],
    models: [sampleModel()],
  });
}

function mockValidCommentOutput(): InteractionContextAssistOutput {
  return {
    taskType: "comment",
    articleTitle: "The Art of Gesture Critique",
    articleOutline: "Explore silhouette contrast techniques and draft evolution.",
  };
}

function mockValidPostOutput(): InteractionContextAssistOutput {
  return {
    taskType: "post",
    titleDirection: "A deep dive into silhouette contrast",
    contentDirection: "Examine how gesture and silhouette shape visual storytelling.",
  };
}

describe("AdminAiControlPlaneStore.assistInteractionTaskContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns structured output for a comment with task context", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValue({
      status: "valid",
      value: mockValidCommentOutput(),
      raw: { text: "", finishReason: "stop", error: null },
    } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);

    const result = await store.assistInteractionTaskContext({
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Current draft asks for critique on gesture and silhouette.",
    });

    expect(result.taskType).toBe("comment");
    if (result.taskType !== "comment") {
      throw new Error("expected comment assist output");
    }
    expect(result.articleTitle).toBe("The Art of Gesture Critique");
    expect(result.articleOutline).toContain("silhouette");
    expect(invokeStructuredLLM).toHaveBeenCalledTimes(1);
    expect(invokeStructuredLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "generic",
        retries: 0,
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Task context: Current draft asks for critique on gesture and silhouette.",
          ),
          maxOutputTokens: 2000,
          temperature: 0.7,
        }),
        schemaGate: expect.objectContaining({
          schemaName: "InteractionContextAssist",
        }),
      }),
    );
  });

  it("returns structured output for a post without task context", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValue({
      status: "valid",
      value: mockValidPostOutput(),
      raw: { text: "", finishReason: "stop", error: null },
    } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);

    const result = await store.assistInteractionTaskContext({
      modelId: "model-1",
      taskType: "post",
      taskContext: "",
    });

    expect(result.taskType).toBe("post");
    if (result.taskType !== "post") {
      throw new Error("expected post assist output");
    }
    expect(result.titleDirection).toContain("silhouette");
    expect(invokeStructuredLLM).toHaveBeenCalledTimes(1);
    expect(invokeStructuredLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Generate a random discussion topic"),
        }),
      }),
    );
  });

  it("throws with schema failure details when structured output fails", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValue({
      status: "schema_failure",
      error: "Schema validation failed: missing required field",
      raw: { text: "{}", finishReason: "stop", error: null },
      schemaGateDebug: {},
    } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);

    await expect(
      store.assistInteractionTaskContext({
        modelId: "model-1",
        taskType: "reply",
        taskContext: "",
      }),
    ).rejects.toThrow(
      "interaction context assist schema failure: Schema validation failed: missing required field",
    );

    expect(invokeStructuredLLM).toHaveBeenCalledTimes(1);
  });

  it("does not include persona data in the prompt", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValue({
      status: "valid",
      value: mockValidCommentOutput(),
      raw: { text: "", finishReason: "stop", error: null },
    } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);

    await store.assistInteractionTaskContext({
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Some context",
    });

    const callArg = vi.mocked(invokeStructuredLLM).mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    const prompt = (callArg as { modelInput: { prompt: string } })?.modelInput?.prompt;
    expect(prompt).not.toContain("Persona:");
    expect(prompt).not.toContain("Reference anchors:");

    // The function no longer takes personaId
    expect(callArg).toBeDefined();
  });
});
