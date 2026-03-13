import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type AiProviderConfig,
} from "@/lib/ai/admin/control-plane-store";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

function buildProvider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
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
    ...overrides,
  };
}

function buildModel(overrides: Partial<AiModelConfig> = {}): AiModelConfig {
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
    maxOutputTokens: 4096,
    metadata: {},
    updatedAt: "2026-03-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("AdminAiControlPlaneStore.recordLlmInvocationError", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not deactivate a model on timeout errors", async () => {
    const store = new AdminAiControlPlaneStore();
    const storeAny = store as any;
    const provider = buildProvider();
    const model = buildModel();
    vi.spyOn(storeAny, "loadActiveForMutation").mockResolvedValue({
      active: null,
      basePolicy: {},
      document: {
        globalPolicyDraft: {
          systemBaseline: "",
          globalPolicy: "",
          styleGuide: "",
          forbiddenRules: "",
        },
      },
      providers: [provider],
      models: [model],
    });
    const upsertModelRow = vi
      .spyOn(storeAny, "upsertModelRow")
      .mockImplementation(async (...args: any[]) => args[0]);
    vi.spyOn(storeAny, "upsertProviderRow").mockImplementation(async (...args: any[]) => args[0]);

    await store.recordLlmInvocationError({
      providerKey: "minimax",
      modelKey: "MiniMax-M2.5",
      error: "LLM_TIMEOUT_12000MS",
    });

    expect(upsertModelRow).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        testStatus: "success",
        lastErrorKind: "provider_api",
      }),
    );
  });

  it("deactivates a model on hard quota or balance exhaustion errors", async () => {
    const store = new AdminAiControlPlaneStore();
    const storeAny = store as any;
    const provider = buildProvider();
    const model = buildModel();
    vi.spyOn(storeAny, "loadActiveForMutation").mockResolvedValue({
      active: null,
      basePolicy: {},
      document: {
        globalPolicyDraft: {
          systemBaseline: "",
          globalPolicy: "",
          styleGuide: "",
          forbiddenRules: "",
        },
      },
      providers: [provider],
      models: [model],
    });
    const upsertModelRow = vi
      .spyOn(storeAny, "upsertModelRow")
      .mockImplementation(async (...args: any[]) => args[0]);
    vi.spyOn(storeAny, "upsertProviderRow").mockImplementation(async (...args: any[]) => args[0]);

    await store.recordLlmInvocationError({
      providerKey: "minimax",
      modelKey: "MiniMax-M2.5",
      error: "insufficient balance",
      errorDetails: { statusCode: 429, code: "insufficient_balance" },
    });

    expect(upsertModelRow).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "disabled",
        testStatus: "failed",
        lastErrorKind: "provider_api",
      }),
    );
  });
});
