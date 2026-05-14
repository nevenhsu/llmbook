import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
} from "@/lib/ai/admin/control-plane-store";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ai/llm/invoke-structured-llm", () => ({
  invokeStructuredLLM: vi.fn(),
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

function structuredResult(value: { text: string; referenceNames: string[] }) {
  return {
    status: "valid" as const,
    value,
    raw: {
      text: JSON.stringify(value),
      finishReason: "stop" as const,
      providerId: "xai",
      modelId: "grok-4-1-fast-reasoning",
      error: undefined,
      usage: {
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
        normalized: true,
      },
      usedFallback: false,
      attempts: 1,
      path: ["xai:grok-4-1-fast-reasoning"],
    },
    schemaGateDebug: {
      flowId: "persona-prompt-assist:model-1",
      stageId: "structured",
      schemaName: "PromptAssist",
      status: "passed" as const,
      attempts: [],
    },
  };
}

describe("AdminAiControlPlaneStore.assistPersonaPrompt", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockReset();
    vi.spyOn(CachedLlmRuntimeConfigProvider.prototype, "getConfig").mockResolvedValue({
      timeoutMs: 12000,
      retries: 1,
      route: { targets: [{ providerId: "xai", modelId: "fallback-model" }] },
    });
  });

  it("makes one structured call and returns text, referenceNames, and debugRecords", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce(
      structuredResult({
        text: "A razor-sharp design critic who rewards originality and distrusts trend-chasing.",
        referenceNames: ["Nora Ephron"],
      }),
    );

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "",
    });

    expect("text" in result).toBe(true);
    if ("text" in result) {
      expect(result.text).toBe(
        "A razor-sharp design critic who rewards originality and distrusts trend-chasing.",
      );
      expect(result.referenceNames).toEqual(["Nora Ephron"]);
      expect(result.debugRecords).toHaveLength(1);
      expect(result.debugRecords[0].name).toBe("prompt_assist");
    }

    expect(invokeStructuredLLM).toHaveBeenCalledTimes(1);
  });

  it("returns failure when the structured output has empty text", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce(
      structuredResult({ text: "", referenceNames: ["Someone"] }),
    );

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "test",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("prompt assist output text is empty");
      expect(result.debugRecords).toHaveLength(1);
    }
  });

  it("returns failure when the structured output has no reference names", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce(
      structuredResult({ text: "A sharp critic.", referenceNames: [] }),
    );

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "test",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe(
        "prompt assist output must include at least one reference name",
      );
    }
  });

  it("returns failure when invokeStructuredLLM reports schema_failure", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce({
      status: "schema_failure",
      error: "Schema validation failed",
      raw: {
        text: "not valid json",
        finishReason: "stop" as const,
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        error: undefined,
        usage: {
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          normalized: true,
        },
        usedFallback: false,
        attempts: 1,
        path: ["xai:grok-4-1-fast-reasoning"],
      },
      schemaGateDebug: {
        flowId: "persona-prompt-assist:model-1",
        stageId: "structured",
        schemaName: "PromptAssist",
        status: "failed" as const,
        attempts: [],
      },
    });

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "test",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("Schema validation failed");
      expect(result.rawText).toBe("not valid json");
    }
  });

  it("deduplicates reference names", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce(
      structuredResult({
        text: "A critic.",
        referenceNames: ["Ada Lovelace", "Ada Lovelace", "  Ada Lovelace  "],
      }),
    );

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "",
    });

    expect("text" in result).toBe(true);
    if ("text" in result) {
      expect(result.referenceNames).toEqual(["Ada Lovelace"]);
    }
  });

  it("trims whitespace from reference names and filters empty ones", async () => {
    const { invokeStructuredLLM } = await import("@/lib/ai/llm/invoke-structured-llm");
    vi.mocked(invokeStructuredLLM).mockResolvedValueOnce(
      structuredResult({
        text: "A critic.",
        referenceNames: ["  Nora Ephron  ", "", "   "],
      }),
    );

    const store = await buildStore();

    const result = await store.assistPersonaPrompt({
      modelId: "model-1",
      inputPrompt: "",
    });

    expect("text" in result).toBe(true);
    if ("text" in result) {
      expect(result.referenceNames).toEqual(["Nora Ephron"]);
    }
  });
});
