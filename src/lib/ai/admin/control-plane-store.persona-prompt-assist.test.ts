import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore, type AiModelConfig } from "@/lib/ai/admin/control-plane-store";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM: vi.fn(),
}));

function sampleModel(): AiModelConfig {
  return {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "grok-4-1-fast-reasoning",
    displayName: "Grok",
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
    maxOutputTokens: 4096,
    metadata: {},
    updatedAt: "2026-03-06T00:00:00.000Z",
  };
}

describe("AdminAiControlPlaneStore.assistPersonaPrompt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses random English instructions when input is empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "A razor-sharp design critic who praises originality, distrusts trend-chasing, and replies with concise, surgical feedback grounded in craft and audience perception.",
      error: null,
    } as never);
    vi.spyOn(CachedLlmRuntimeConfigProvider.prototype, "getConfig").mockResolvedValue({
      timeoutMs: 12000,
      retries: 1,
      route: { targets: [{ providerId: "xai", modelId: "fallback-model" }] },
    });

    const store = new AdminAiControlPlaneStore();
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
          providerKey: "xai",
          displayName: "xAI",
          sdkPackage: "@ai-sdk/xai",
          status: "active",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [sampleModel()],
    });

    const text = await store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" });

    expect(text).toContain("razor-sharp");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        routeOverride: {
          targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }],
        },
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("English only."),
        }),
      }),
    );
  });

  it("uses optimize instructions and preserves same-language guidance when input exists", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "用直接、挑剔但有建設性的語氣，塑造一位偏愛高訊號討論、反感空泛吹捧，總能快速指出作品核心取捨的論壇人格。",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
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
          providerKey: "xai",
          displayName: "xAI",
          sdkPackage: "@ai-sdk/xai",
          status: "active",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [sampleModel()],
    });

    const text = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "想要一個尖銳但不失專業的設計評論人格",
    });

    expect(text).toContain("用直接");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Keep the same language as the user's input."),
        }),
      }),
    );
  });

  it("explicitly preserves named references in optimized prompts", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "以伊坂幸太郎、Fleabag 和深夜咖啡店觀察為參考，塑造一位擅長把日常細節串成尖銳角色判斷、口氣輕鬆但觀察很準的論壇人格。",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
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
          providerKey: "xai",
          displayName: "xAI",
          sdkPackage: "@ai-sdk/xai",
          status: "active",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [sampleModel()],
    });

    const text = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "請保留伊坂幸太郎、Fleabag 和深夜咖啡店觀察這些參考對象",
    });

    expect(text).toContain("伊坂幸太郎");
    expect(text).toContain("Fleabag");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Preserve explicit reference names such as creators, artists, public figures, and fictional characters when the user provides them.",
          ),
        }),
      }),
    );
  });

  it("does not reject prompt assist solely because provider status is disabled", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "A blunt cultural critic who rewards specificity, distrusts hype, and responds with fast, pointed judgments grounded in taste and incentives.",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
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
          displayName: "Minimax",
          sdkPackage: "vercel-minimax-ai-provider",
          status: "disabled",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [
        {
          ...sampleModel(),
          modelKey: "MiniMax-M2.1",
          displayName: "MiniMax M2.1",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" }),
    ).resolves.toContain("critic");
  });

  it("falls back to the normalized input prompt when the model returns empty text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "   ",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
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
          providerKey: "xai",
          displayName: "xAI",
          sdkPackage: "@ai-sdk/xai",
          status: "active",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [sampleModel()],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "  請保留 伊坂幸太郎 與 Fleabag 的參考，讓角色更有判斷力  ",
      }),
    ).resolves.toBe("請保留 伊坂幸太郎 與 Fleabag 的參考，讓角色更有判斷力");
  });

  it("falls back to a default seed prompt when the model returns empty text for empty input", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "",
      error: null,
    } as never);

    const store = new AdminAiControlPlaneStore();
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
          providerKey: "xai",
          displayName: "xAI",
          sdkPackage: "@ai-sdk/xai",
          status: "active",
          testStatus: "success",
          keyLast4: "1234",
          hasKey: true,
          lastApiErrorCode: null,
          lastApiErrorMessage: null,
          lastApiErrorAt: null,
          createdAt: "2026-03-06T00:00:00.000Z",
          updatedAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      models: [sampleModel()],
    });

    await expect(store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" })).resolves.toBe(
      "A forum persona with clear taste, grounded observations, and a distinct point of view.",
    );
  });
});
