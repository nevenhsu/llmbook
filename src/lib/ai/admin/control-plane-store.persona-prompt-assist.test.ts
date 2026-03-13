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
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uses random English instructions when input is empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
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
          prompt: expect.stringContaining("Choose 1 to 3 real famous reference entities"),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Use at least 1 of these resolved reference entities: Nora Ephron.",
          ),
        }),
      }),
    );
  });

  it("uses optimize instructions and preserves same-language guidance when input exists", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "王家衛",
        error: null,
      } as never)
      .mockResolvedValueOnce({
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
          prompt: expect.stringContaining(
            "Infer 1 to 3 fitting real reference entities from the user's persona clues.",
          ),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Use at least 1 of these resolved reference entities if they fit: 王家衛.",
          ),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Use the resolved reference as behavioral source material, not just as a name to mention.",
          ),
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
    expect(invokeLLM).not.toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Use this exact added reference name:"),
        }),
      }),
    );
  });

  it("does not reject prompt assist solely because provider status is disabled", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "James Baldwin",
        error: null,
      } as never)
      .mockResolvedValueOnce({
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
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" }),
    ).resolves.toContain("critic");
  });

  it("falls back to a clearer persona brief when the model returns empty text", async () => {
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

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "  請保留 伊坂幸太郎 與 Fleabag 的參考，讓角色更有判斷力  ",
    });

    expect(result).toContain("伊坂幸太郎");
    expect(result).toContain("Fleabag");
    expect(result).toContain("審美立場");
    expect(result).not.toBe("請保留 伊坂幸太郎 與 Fleabag 的參考，讓角色更有判斷力");
  });

  it("falls back to a default seed prompt when the model returns empty text for empty input", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "James Baldwin",
        error: null,
      } as never)
      .mockResolvedValueOnce({
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
      "A forum persona shaped by James Baldwin, with grounded observations, sharp taste, and concise, opinionated replies.",
    );
  });

  it("injects a concrete reference name when the model returns only abstract optimize text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "王家衛",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "用直接、挑剔但有建設性的語氣，塑造一位偏愛高訊號討論、反感空泛吹捧的論壇人格。",
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
        inputPrompt: "想要一個尖銳但不失專業的設計評論人格",
      }),
    ).resolves.toContain("王家衛");
  });

  it("retries optimize mode when the first rewrite only appends a reference name", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "Generate a witty but respectful creator persona. Reference Joan Didion.",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A witty but respectful creator persona who values craft over hype, gives specific but considerate feedback, and engages others with dry confidence. Reference Joan Didion.",
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
        inputPrompt: "Generate a witty but respectful creator persona.",
      }),
    ).resolves.toBe(
      "A witty but respectful creator persona who values craft over hype, gives specific but considerate feedback, and engages others with dry confidence. Reference Joan Didion.",
    );

    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Avoid generic persona language such as witty but respectful, sharp taste, grounded observations, or values craft over hype unless the reference truly supports it.",
          ),
        }),
      }),
    );
  });

  it("uses resolved reference entities to rewrite short work-title inputs into a clearer persona brief", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Monkey D. Luffy | Eiichiro Oda",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A persona inspired by a One Piece anime character, with bold optimism, chaotic loyalty, and impulsive warmth. Reference Monkey D. Luffy.",
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

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "one piece",
    });

    expect(result).toContain("One Piece anime character");
    expect(result).toContain("Monkey D. Luffy");
    expect(result).not.toContain("a one piece");
  });
});
