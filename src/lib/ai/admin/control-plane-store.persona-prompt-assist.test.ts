import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore, type AiModelConfig } from "@/lib/ai/admin/control-plane-store";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";
import { PROMPT_ASSIST_MAX_OUTPUT_TOKENS } from "@/lib/ai/admin/persona-generation-token-budgets";

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
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockReset();
  });

  it("uses random English instructions when input is empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A razor-sharp design critic shaped by Nora Ephron, praising originality, distrusting trend-chasing, and replying with concise, surgical feedback grounded in craft and audience perception.",
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
        retries: 0,
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
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Hint at how the persona opens a post or live reply, what metaphor domains it reaches for, how it attacks weak claims, and what praise sounds like when it is genuinely convinced.",
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
        text: "以王家衛為參考，用直接、挑剔但有建設性的語氣，塑造一位偏愛高訊號討論、反感空泛吹捧，總能快速指出作品核心取捨的論壇人格。",
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
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Seed task-facing style behavior: hint at how the persona opens posts or live replies, what metaphor domains it reaches for, how it attacks weak claims, what praise sounds like when convinced, and what tidy shapes it resists.",
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

  it("repairs optimize-mode output when an explicit source reference name is paraphrased away", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "A globe-trotting storyteller who treats every meal as a portal to a culture's soul, opening posts with sensory snapshots from forgotten alleyways. He reaches for travel, labor, and class metaphors, attacking elitist food snobbery with the ferocity of a chef who actually worked the line. Praise sounds like quiet reverence for kitchens where survival happens. He resists polished travel content, foodie posturing, and any tidy conclusion about a place or person, insisting the mystery and mess are the whole point.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a globe-trotting storyteller who treats every meal as a portal to a culture's soul, opens posts with sensory snapshots from forgotten alleyways, attacks elitist food snobbery with line-cook contempt, and praises kitchens only with quiet reverence earned through labor.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Anthony Bourdain",
      }),
    ).resolves.toContain("Anthony Bourdain");

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "The user explicitly referenced these names: Anthony Bourdain.",
          ),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "The user explicitly referenced these names: Anthony Bourdain.",
          ),
        }),
      }),
    );
  });

  it("injects explicit source reference names into empty-output repair prompts", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a globe-trotting cultural critic who opens with a lived-detail hook, attacks soft foodie posturing with line-cook skepticism, and only praises work when it earns appetite, labor, and risk.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Anthony Bourdain",
      }),
    ).resolves.toContain("Anthony Bourdain");

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "The user explicitly referenced these names: Anthony Bourdain.",
          ),
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
        text: "A blunt cultural critic shaped by James Baldwin who rewards specificity, distrusts hype, and responds with fast, pointed judgments grounded in taste and incentives.",
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

  it("uses the higher shared prompt-assist output cap", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "James Baldwin",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A blunt cultural critic shaped by James Baldwin who opens with hard-earned clarity, distrusts hype, attacks vague claims head-on, and only praises work after it proves itself.",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
          maxOutputTokens: 4096,
        },
      ],
    });

    await store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          maxOutputTokens: PROMPT_ASSIST_MAX_OUTPUT_TOKENS,
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          maxOutputTokens: PROMPT_ASSIST_MAX_OUTPUT_TOKENS,
        }),
      }),
    );
  });

  it("retries optimize mode when the main rewrite returns empty text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "   ",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A witty but respectful creator persona sharpened through Nora Ephron, opening with dry candor, trusting lived detail over hype, and praising others only when the work actually earns it.",
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
    ).resolves.toContain("Nora Ephron");

    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Your previous prompt-assist output was empty."),
        }),
      }),
    );
  });

  it("throws when optimize-mode empty-output repair is also empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
      } as never)
      .mockResolvedValueOnce({
        text: "   ",
        error: null,
        finishReason: "length",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
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
    ).rejects.toMatchObject({
      name: "PromptAssistError",
      code: "prompt_assist_repair_output_empty",
      message: "prompt assist repair returned empty output",
      details: {
        attemptStage: "empty_output_repair",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        finishReason: "length",
        hadText: false,
      },
    });
  });

  it("retries random mode when the main rewrite returns empty text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "James Baldwin",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A blunt cultural critic shaped by James Baldwin who opens with hard-earned clarity, distrusts hype, attacks vague claims head-on, and only praises work after it proves itself.",
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
      "A blunt cultural critic shaped by James Baldwin who opens with hard-earned clarity, distrusts hype, attacks vague claims head-on, and only praises work after it proves itself.",
    );

    expect(invokeLLM).toHaveBeenCalledTimes(3);
  });

  it("throws when the model omits an explicit reference name in the final optimize output", async () => {
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
    ).rejects.toMatchObject({
      name: "PromptAssistError",
      code: "prompt_assist_missing_reference",
      message: "prompt assist output must include at least 1 explicit real reference name",
    });
  });

  it("throws a typed timeout error when the provider times out before returning prompt-assist text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Nora Ephron",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: "LLM_TIMEOUT_12000MS",
        errorDetails: { code: "TIMEOUT", statusCode: 504 },
        finishReason: "error",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
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
    ).rejects.toMatchObject({
      name: "PromptAssistError",
      code: "prompt_assist_provider_timeout",
      details: {
        attemptStage: "main_rewrite",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        finishReason: "error",
        hadText: false,
      },
    });
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
            "Make the brief imply a concrete opening move, recurring metaphor domains, how weak claims get challenged, what praise sounds like when earned, and what kind of tidy post/comment shapes this persona resists.",
          ),
        }),
      }),
    );
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

  it("repairs truncated optimize-mode output before returning it", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Anthony Bourdain",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a creator who approaches culture through food and travel, opens threads with a provocative question or",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a creator who approaches culture through food and travel, opens threads with a provocative question, attacks weak claims with lived-detail skepticism, and praises work only when it earns real appetite and risk.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Generate a witty but respectful creator persona.",
      }),
    ).resolves.toContain("attacks weak claims with lived-detail skepticism");

    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("The previous rewrite was truncated or incomplete."),
        }),
      }),
    );
  });

  it("throws a typed error when truncated-output repair is still incomplete", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Anthony Bourdain",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a creator who approaches culture through food and travel, opens threads with a provocative question or",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain, attacking weak claims with lived-detail skepticism and praising creators only when",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Generate a witty but respectful creator persona.",
      }),
    ).rejects.toMatchObject({
      name: "PromptAssistError",
      code: "prompt_assist_truncated_output",
      details: {
        attemptStage: "truncated_output_repair",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
        finishReason: "length",
        hadText: true,
      },
    });
  });

  it("throws a repair-output-empty error with truncation-repair details when truncated repair returns blank text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Anthony Bourdain",
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: "A forum persona modeled on Anthony Bourdain: a creator who approaches culture through food and travel, opens threads with a provocative question or",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "   ",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
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
      models: [
        {
          ...sampleModel(),
          providerId: "provider-1",
          modelKey: "MiniMax-M2.5",
          displayName: "MiniMax M2.5",
        },
      ],
    });

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Generate a witty but respectful creator persona.",
      }),
    ).rejects.toMatchObject({
      name: "PromptAssistError",
      code: "prompt_assist_repair_output_empty",
      message: "prompt assist truncation repair returned empty output",
      details: {
        attemptStage: "truncated_output_repair",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
        finishReason: "length",
        hadText: false,
      },
    });
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
