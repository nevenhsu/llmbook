import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";

const { createDbBackedLlmProviderRegistry, resolveLlmInvocationConfig, invokeLLM } = vi.hoisted(
  () => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { targets: [{ providerId: "deepseek", modelId: "deepseek-v4-flash" }] },
      timeoutMs: 20_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async () => ({
      text: "pong",
      finishReason: "stop",
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
        normalized: false,
      },
      usedFallback: false,
      attempts: 1,
      path: ["deepseek:deepseek-v4-flash"],
    })),
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry,
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig,
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM,
}));

function buildProvider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    id: "provider-1",
    providerKey: "deepseek",
    displayName: "DeepSeek",
    sdkPackage: "@ai-sdk/deepseek",
    status: "active",
    testStatus: "untested",
    keyLast4: "1234",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
}

function buildModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
  return {
    id: "model-1",
    providerId: "provider-1",
    modelKey: "deepseek-v4-flash",
    displayName: "DeepSeek-V4-Flash",
    capability: "text_generation",
    status: "disabled",
    testStatus: "untested",
    lifecycleStatus: "active",
    displayOrder: 1,
    lastErrorKind: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastErrorAt: null,
    supportsInput: true,
    supportsImageInputPrompt: false,
    supportsOutput: true,
    contextWindow: null,
    maxOutputTokens: null,
    metadata: {},
    updatedAt: "2026-04-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("AdminAiControlPlaneStore.testModelWithMinimalTokens", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockClear();
    resolveLlmInvocationConfig.mockClear();
    invokeLLM.mockClear();
  });

  it("returns the sampled text response as an artifact for successful text model tests", async () => {
    const store = new AdminAiControlPlaneStore();
    const storeAny = store as any;
    const provider = buildProvider();
    const model = buildModel();

    vi.spyOn(storeAny, "loadActiveForMutation").mockResolvedValue({
      providers: [provider],
      models: [model],
    });
    vi.spyOn(storeAny, "upsertModelRow").mockImplementation(async (...args: any[]) => args[0]);
    vi.spyOn(storeAny, "upsertProviderRow").mockImplementation(async (...args: any[]) => args[0]);

    const result = await store.testModelWithMinimalTokens("model-1", "admin-user");

    expect(result.artifact).toEqual({ text: "pong" });
    expect(result.model.testStatus).toBe("success");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          maxOutputTokens: 32,
        }),
        manualMode: "never",
      }),
    );
  });

  it("fails text model tests that return empty text", async () => {
    invokeLLM.mockResolvedValueOnce({
      text: "",
      finishReason: "stop",
      providerId: "deepseek",
      modelId: "deepseek-v4-flash",
      usage: {
        inputTokens: 1,
        outputTokens: 0,
        totalTokens: 1,
        normalized: false,
      },
      usedFallback: false,
      attempts: 1,
      path: ["deepseek:deepseek-v4-flash"],
    });

    const store = new AdminAiControlPlaneStore();
    const storeAny = store as any;
    const provider = buildProvider();
    const model = buildModel();

    vi.spyOn(storeAny, "loadActiveForMutation").mockResolvedValue({
      providers: [provider],
      models: [model],
    });
    vi.spyOn(storeAny, "upsertModelRow").mockImplementation(async (...args: any[]) => args[0]);
    vi.spyOn(storeAny, "upsertProviderRow").mockImplementation(async (...args: any[]) => args[0]);

    const result = await store.testModelWithMinimalTokens("model-1", "admin-user");

    expect(result.artifact).toBeUndefined();
    expect(result.model.testStatus).toBe("failed");
    expect(result.model.lastErrorMessage).toBe("Model returned empty output");
  });
});
