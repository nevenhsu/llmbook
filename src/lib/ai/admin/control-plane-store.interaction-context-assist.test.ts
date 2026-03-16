import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore, type AiModelConfig } from "@/lib/ai/admin/control-plane-store";

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

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM: vi.fn(),
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
    activeRelease: null,
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
    releases: [],
  });
}

describe("AdminAiControlPlaneStore.assistInteractionTaskContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uses existing task context in the first prompt and returns the first non-empty model output", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "Push the silhouette contrast further and explain what changed between the two drafts.",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue({
      persona: {
        id: "persona-1",
        username: "ai_critic",
        display_name: "AI Critic",
        bio: "bio",
        status: "active",
      },
      personaCore: {
        reference_sources: [{ name: "John Grisham", type: "author" }],
      },
      personaMemories: [],
    });

    const result = await store.assistInteractionTaskContext({
      modelId: "model-1",
      taskType: "comment",
      personaId: "persona-1",
      taskContext: "Current draft asks for critique on gesture and silhouette.",
    });

    expect(result).toContain("silhouette");
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        taskType: "generic",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Existing task context:\nCurrent draft asks for critique on gesture and silhouette.",
          ),
          maxOutputTokens: 900,
          temperature: 0.4,
        }),
      }),
    );
  });

  it("retries with a higher cap and then throws an explicit empty-output error when the model stays empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "   ",
        finishReason: "length",
        error: null,
        attempts: 1,
      } as never)
      .mockResolvedValueOnce({
        text: "",
        finishReason: "error",
        error: "PROVIDER_ERROR_OUTPUT",
        attempts: 2,
      } as never);

    const store = new AdminAiControlPlaneStore();
    mockActiveControlPlane(store);
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue({
      persona: {
        id: "persona-1",
        username: "ai_critic",
        display_name: "AI Critic",
        bio: "bio",
        status: "active",
      },
      personaCore: {
        reference_sources: [{ name: "Nora Ephron", type: "writer" }],
      },
      personaMemories: [],
    });

    await expect(
      store.assistInteractionTaskContext({
        modelId: "model-1",
        taskType: "post",
        personaId: "persona-1",
        taskContext: "",
      }),
    ).rejects.toThrow(
      "interaction context assist returned empty output (finishReason=error; error=PROVIDER_ERROR_OUTPUT; attempts=2)",
    );

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        modelInput: expect.objectContaining({ maxOutputTokens: 900, temperature: 0.4 }),
      }),
    );
    expect(vi.mocked(invokeLLM).mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        modelInput: expect.objectContaining({ maxOutputTokens: 1400, temperature: 0.2 }),
      }),
    );
  });
});
