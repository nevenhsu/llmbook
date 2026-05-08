import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  PromptAssistError,
  type AiModelConfig,
} from "@/lib/ai/admin/control-plane-store";
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

function sampleModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
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
    ...overrides,
  };
}

function promptAssistNamedReference(
  name: string,
  type:
    | "real_person"
    | "historical_figure"
    | "fictional_character"
    | "mythic_figure"
    | "iconic_persona" = "real_person",
) {
  return { name, type };
}

function promptAssistReferenceOutput(input: {
  namedReferences: Array<{
    name: string;
    type:
      | "real_person"
      | "historical_figure"
      | "fictional_character"
      | "mythic_figure"
      | "iconic_persona";
  }>;
}) {
  return JSON.stringify(input);
}

function auditResult(input: { passes: boolean; issues?: string[]; repairGuidance?: string[] }) {
  return JSON.stringify({
    passes: input.passes,
    issues: input.issues ?? [],
    repairGuidance: input.repairGuidance ?? [],
  });
}

function buildActiveControlPlane(model: AiModelConfig = sampleModel()) {
  const providerKey = model.modelKey.startsWith("MiniMax") ? "minimax" : "xai";
  const providerDisplayName = providerKey === "minimax" ? "Minimax" : "xAI";
  const providerSdkPackage =
    providerKey === "minimax" ? "vercel-minimax-ai-provider" : "@ai-sdk/xai";
  return {
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
        id: model.providerId,
        providerKey,
        displayName: providerDisplayName,
        sdkPackage: providerSdkPackage,
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
    models: [model],
  };
}

async function buildStore(model: AiModelConfig = sampleModel()) {
  const store = new AdminAiControlPlaneStore();
  vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(buildActiveControlPlane(model) as any);
  return store;
}

describe("AdminAiControlPlaneStore.assistPersonaPrompt", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockReset();
    vi.spyOn(CachedLlmRuntimeConfigProvider.prototype, "getConfig").mockResolvedValue({
      timeoutMs: 12000,
      retries: 1,
      route: { targets: [{ providerId: "xai", modelId: "fallback-model" }] },
    });
  });

  it("resolves reference JSON first, generates text second, and appends a fixed trailing reference suffix", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Nora Ephron", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: "A razor-sharp design critic who rewards originality, distrusts trend-chasing, and replies with concise, surgical feedback grounded in craft and audience perception.",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "rewrite-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({ modelId: "model-1", inputPrompt: "" }),
    ).resolves.toMatchObject({
      text: "A razor-sharp design critic who rewards originality, distrusts trend-chasing, and replies with concise, surgical feedback grounded in craft and audience perception. Reference sources: Nora Ephron.",
      referenceNames: ["Nora Ephron"],
    });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            'Shape: {"namedReferences": [{"name": string, "type": string}]}',
          ),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Do not append a separate reference list; the server will append a fixed trailing reference-sources suffix.",
          ),
        }),
      }),
    );
  });

  it("keeps same-language guidance for the text stage while still appending the fixed English suffix", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("王家衛", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: "一位以冷靜、疏離、但極度敏銳的語氣回應論壇討論的人格，擅長把情緒縫隙與時間錯位拆成具體觀察。",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "rewrite-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "想要一個像王家衛一樣疏離又敏銳的論壇人格",
      }),
    ).resolves.toMatchObject({
      text: "一位以冷靜、疏離、但極度敏銳的語氣回應論壇討論的人格，擅長把情緒縫隙與時間錯位拆成具體觀察。 Reference sources: 王家衛.",
      referenceNames: ["王家衛"],
    });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Keep the same language as the user's input."),
        }),
      }),
    );
  });

  it("repairs invalid reference-resolution output into valid namedReferences JSON before generating text", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "Leo Tolstoy",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Leo Tolstoy", "historical_figure")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A Russian moral philosopher who frames every thread as a test of conscience and exposes shallow certainty by pressing on the soul beneath the argument.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-2",
        modelKey: "MiniMax-M2.5",
        displayName: "MiniMax M2.5",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Leo Tolstoy",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Leo Tolstoy.") as string,
      referenceNames: ["Leo Tolstoy"],
    });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Your previous reference-resolution output did not follow the required JSON contract.",
          ),
        }),
      }),
    );
  });

  it("repairs reference audit failures when the resolver returns a work title instead of a personality-bearing figure", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("In the Mood for Love", "iconic_persona")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({
          passes: false,
          issues: ["Works and titles are clues, not valid namedReferences by themselves."],
          repairGuidance: [
            "Replace the title with a personality-bearing figure inferred from the clue.",
          ],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Wong Kar-wai", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: "A moody romantic observer who turns every disagreement into a suspended hallway of memory, longing, and missed timing.",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "rewrite-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "In the Mood for Love",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Wong Kar-wai.") as string,
      referenceNames: ["Wong Kar-wai"],
    });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("[original_input]"),
        }),
      }),
    );
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Return only the namedReferences JSON object."),
        }),
      }),
    );
  });

  it("repairs empty text output without re-running reference audit", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Anthony Bourdain", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A globe-trotting raconteur who opens with sensory detail, distrusts polished travel posturing, and praises work only when it earns appetite, labor, and risk.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-2",
        modelKey: "MiniMax-M2.5",
        displayName: "MiniMax M2.5",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Anthony Bourdain",
      }),
    ).resolves.toMatchObject({
      text: "A globe-trotting raconteur who opens with sensory detail, distrusts polished travel posturing, and praises work only when it earns appetite, labor, and risk. Reference sources: Anthony Bourdain.",
      referenceNames: ["Anthony Bourdain"],
    });

    expect(invokeLLM).toHaveBeenCalledTimes(4);
    expect(invokeLLM).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("Your previous prompt-assist output was empty."),
        }),
      }),
    );
  });

  it("repairs truncated text output before assembling the fixed trailing reference suffix", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("James Baldwin", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: "A cutting moral witness who turns every thread into a confrontation with complicity and insists on a harder truth than comfort can",
        error: null,
        finishReason: "length",
        providerId: "xai",
        modelId: "rewrite-model",
      } as never)
      .mockResolvedValueOnce({
        text: "A cutting moral witness who turns every thread into a confrontation with complicity and insists on a harder truth than comfort can tolerate.",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "rewrite-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "James Baldwin",
      }),
    ).resolves.toMatchObject({
      text: "A cutting moral witness who turns every thread into a confrontation with complicity and insists on a harder truth than comfort can tolerate. Reference sources: James Baldwin.",
      referenceNames: ["James Baldwin"],
    });
  });

  it("fails with raw reference JSON when audit still cannot recover a valid personality-bearing reference", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [
            promptAssistNamedReference("One Hundred Years of Solitude", "iconic_persona"),
          ],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({
          passes: false,
          issues: ["Works and titles are clues, not valid namedReferences by themselves."],
          repairGuidance: ["Infer a personality-bearing figure from the title."],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [
            promptAssistNamedReference("One Hundred Years of Solitude", "iconic_persona"),
          ],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({
          passes: false,
          issues: ["Works and titles are clues, not valid namedReferences by themselves."],
          repairGuidance: ["Infer a personality-bearing figure from the title."],
        }),
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "audit-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "One Hundred Years of Solitude",
      }),
    ).rejects.toMatchObject({
      code: "prompt_assist_missing_reference",
      details: expect.objectContaining({
        rawText: promptAssistReferenceOutput({
          namedReferences: [
            promptAssistNamedReference("One Hundred Years of Solitude", "iconic_persona"),
          ],
        }),
      }),
    } satisfies Partial<PromptAssistError>);
  });

  it("fails with a typed invalid-reference error when reference repair still does not return valid JSON", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "William Shakespeare",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never)
      .mockResolvedValueOnce({
        text: "still not json",
        error: null,
        finishReason: "stop",
        providerId: "xai",
        modelId: "resolver-model",
      } as never);

    const store = await buildStore();

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "William Shakespeare",
      }),
    ).rejects.toMatchObject({
      code: "prompt_assist_invalid_reference_output",
      details: expect.objectContaining({
        rawText: "still not json",
      }),
    } satisfies Partial<PromptAssistError>);
  });

  it("retries reference-resolution repair with a shorter prompt when the first repair attempt is length-truncated and empty", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "length",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Sigmund Freud", "historical_figure")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A clinical excavator of motive who opens with unsettling questions, treats every thread as a case history, and exposes rationalizations with cool interpretive pressure.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-2",
        modelKey: "MiniMax-M2.5",
        displayName: "MiniMax M2.5",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Sigmund Freud",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Sigmund Freud.") as string,
      referenceNames: ["Sigmund Freud"],
    });

    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          maxOutputTokens: 320,
          prompt: expect.stringContaining("[compact_retry_repair]"),
        }),
      }),
    );
  });

  it("does not fail missing-reference when the first reference audit is empty but the audit retry passes for valid namedReferences", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Joseph Campbell", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: auditResult({ passes: true }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A myth-minded guide who frames every argument as a rite of passage, prizes symbolic depth over literal certainty, and praises insight that earns its transformation.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-2",
        modelKey: "MiniMax-M2.5",
        displayName: "MiniMax M2.5",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Joseph Campbell",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Joseph Campbell.") as string,
      referenceNames: ["Joseph Campbell"],
    });
  });

  it("uses the audit schema for reference_presence_audit and accepts object-only structured audit output", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Ursula K. Le Guin", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "deepseek",
        modelId: "deepseek-v4-flash",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        object: {
          passes: true,
          issues: [],
          repairGuidance: [],
        },
        error: null,
        finishReason: "stop",
        providerId: "deepseek",
        modelId: "deepseek-v4-flash",
      } as never)
      .mockResolvedValueOnce({
        text: "A lucid world-builder who turns every debate into a question of social design, distrusts inevitability, and praises ideas that widen the imaginable.",
        error: null,
        finishReason: "stop",
        providerId: "deepseek",
        modelId: "deepseek-v4-flash",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-3",
        modelKey: "deepseek-v4-flash",
        displayName: "DeepSeek V4 Flash",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Ursula K. Le Guin",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Ursula K. Le Guin.") as string,
      referenceNames: ["Ursula K. Le Guin"],
    });

    expect(invokeLLM).toHaveBeenCalledTimes(3);
    const referenceAuditOutput = vi.mocked(invokeLLM).mock.calls[1]?.[0]?.modelInput.output as
      | { responseFormat?: Promise<{ schema?: { properties?: Record<string, unknown> } }> }
      | undefined;
    const responseFormat = await referenceAuditOutput?.responseFormat;
    expect(Object.keys(responseFormat?.schema?.properties ?? {})).toEqual(
      expect.arrayContaining(["passes", "issues", "repairGuidance"]),
    );
    expect(Object.keys(responseFormat?.schema?.properties ?? {})).not.toContain("namedReferences");
  });

  it("treats an empty reference audit as inconclusive instead of failing a structurally valid namedReferences JSON stage", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: promptAssistReferenceOutput({
          namedReferences: [promptAssistNamedReference("Joseph Campbell", "real_person")],
        }),
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never)
      .mockResolvedValueOnce({
        text: "A myth-minded guide who frames every argument as a rite of passage, prizes symbolic depth over literal certainty, and praises insight that earns its transformation.",
        error: null,
        finishReason: "stop",
        providerId: "minimax",
        modelId: "MiniMax-M2.5",
      } as never);

    const store = await buildStore(
      sampleModel({
        providerId: "provider-2",
        modelKey: "MiniMax-M2.5",
        displayName: "MiniMax M2.5",
      }),
    );

    await expect(
      store.assistPersonaPrompt({
        modelId: "model-1",
        inputPrompt: "Joseph Campbell",
      }),
    ).resolves.toMatchObject({
      text: expect.stringContaining("Reference sources: Joseph Campbell.") as string,
      referenceNames: ["Joseph Campbell"],
    });
  });
});
