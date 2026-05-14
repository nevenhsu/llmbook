import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
} from "@/lib/ai/admin/control-plane-contract";
import { PersonaGenerationParseError } from "@/lib/ai/admin/control-plane-contract";
import { FALLBACK_PERSONA_CORE_V2 } from "@/lib/ai/core/persona-core-v2";

const { invokeStructuredLLM, invokeLLM } = vi.hoisted(() => ({
  invokeStructuredLLM: vi.fn(),
  invokeLLM: vi.fn(),
}));

vi.mock("@/lib/ai/llm/invoke-structured-llm", () => ({
  invokeStructuredLLM,
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM,
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig: vi.fn(async () => ({
    route: {
      targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }],
    },
    timeoutMs: 1000,
    retries: 0,
  })),
}));

import { previewPersonaGeneration } from "./persona-generation-preview-service";

const document: AiControlPlaneDocument = {
  globalPolicyDraft: {
    systemBaseline: "Generate a coherent forum persona profile.",
    globalPolicy: "Policy: stay useful.",
    styleGuide: "Plain and compact.",
    forbiddenRules: "Forbidden: no markdown wrappers.",
  },
};

const providers: AiProviderConfig[] = [
  {
    id: "provider-xai",
    providerKey: "xai",
    displayName: "xAI",
    sdkPackage: "@ai-sdk/xai",
    status: "active",
    testStatus: "success",
    keyLast4: "test",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-05-08T00:00:00.000Z",
    updatedAt: "2026-05-08T00:00:00.000Z",
  },
];

const models: AiModelConfig[] = [
  {
    id: "model-xai",
    providerId: "provider-xai",
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
    updatedAt: "2026-05-08T00:00:00.000Z",
  },
];

describe("previewPersonaGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeLLM.mockResolvedValue({
      text: JSON.stringify({
        passes: true,
        issues: [],
        repairGuidance: [],
      }),
      finishReason: "stop",
      providerId: "xai",
      modelId: "grok-4-1-fast-reasoning",
      error: null,
    });
  });

  it("routes persona_core_v2 main through invokeStructuredLLM and exposes schemaGateDebug on schema failure", async () => {
    const schemaGateDebug = {
      flowId: "persona-generation-preview:model-xai:persona_core_v2:attempt-1",
      stageId: "structured",
      schemaName: "PersonaCoreV2Schema",
      status: "failed" as const,
      attempts: [
        {
          attemptStage: "field_patch" as const,
          finishReason: "length",
          likelyOpenPath: "reference_style",
          requiredRemainingPaths: ["reference_style.reference_names"],
          errorSummary: "field patch failed",
        },
      ],
    };

    invokeStructuredLLM.mockResolvedValueOnce({
      status: "schema_failure",
      error: "Schema gate failed for PersonaCoreV2Schema",
      raw: {
        text: '{"identity":{}}',
        finishReason: "length",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["xai:grok-4-1-fast-reasoning"],
        object: null,
      },
      schemaGateDebug,
    });

    await expect(
      previewPersonaGeneration({
        modelId: "model-xai",
        extraPrompt: "Make a severe but useful systems critic.",
        document,
        providers,
        models,
        debug: true,
        recordLlmInvocationError: vi.fn(),
      }),
    ).rejects.toMatchObject({
      message: "Schema gate failed for PersonaCoreV2Schema",
      details: {
        schemaGateDebug,
        stageDebugRecords: [
          {
            name: "persona_core_v2",
            attempts: [
              expect.objectContaining({
                attempt: "attempt-1",
                schemaGateDebug,
                hadError: true,
              }),
            ],
          },
        ],
      },
    } satisfies Partial<PersonaGenerationParseError>);

    expect(invokeStructuredLLM).toHaveBeenCalledTimes(1);
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(invokeStructuredLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaGate: expect.objectContaining({
          schemaName: "PersonaCoreV2Schema",
          validationRules: expect.not.arrayContaining([expect.stringContaining("schema_version")]),
        }),
      }),
    );
    const prompt = invokeStructuredLLM.mock.calls[0][0].modelInput.prompt;
    expect(prompt).not.toContain("schema_version");
  });

  it("inserts the admin extra prompt once through user_input_context instead of duplicating it in the top-level prompt blocks", async () => {
    const extraPrompt = "Make a severe but useful systems critic.";
    invokeStructuredLLM.mockResolvedValueOnce({
      status: "valid",
      value: FALLBACK_PERSONA_CORE_V2,
      raw: {
        text: JSON.stringify(FALLBACK_PERSONA_CORE_V2),
        finishReason: "stop",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["xai:grok-4-1-fast-reasoning"],
        object: FALLBACK_PERSONA_CORE_V2,
      },
      schemaGateDebug: {
        flowId: "persona-generation-preview:model-xai:persona_core_v2:attempt-1",
        stageId: "structured",
        schemaName: "PersonaCoreV2Schema",
        status: "valid",
        attempts: [],
      },
    });

    await previewPersonaGeneration({
      modelId: "model-xai",
      extraPrompt,
      document,
      providers,
      models,
      debug: true,
      recordLlmInvocationError: vi.fn(),
    });

    const prompt = invokeStructuredLLM.mock.calls[0][0].modelInput.prompt as string;
    expect(prompt).toContain(`user_input_context:\n${extraPrompt}`);
    expect(prompt).not.toContain(`[admin_extra_prompt]\n${extraPrompt}`);
    expect(prompt.split(extraPrompt)).toHaveLength(2);
  });

  it("returns the shared prompt bundle and token budget from the canonical builder", async () => {
    invokeStructuredLLM.mockResolvedValueOnce({
      status: "valid",
      value: FALLBACK_PERSONA_CORE_V2,
      raw: {
        text: JSON.stringify(FALLBACK_PERSONA_CORE_V2),
        finishReason: "stop",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150, normalized: false },
        usedFallback: false,
        attempts: 1,
        path: ["xai:grok-4-1-fast-reasoning"],
        object: FALLBACK_PERSONA_CORE_V2,
      },
      schemaGateDebug: {
        flowId: "persona-generation-preview:model-xai:persona_core_v2:attempt-1",
        stageId: "structured",
        schemaName: "PersonaCoreV2Schema",
        status: "valid",
        attempts: [],
      },
    });
    const result = await previewPersonaGeneration({
      modelId: "model-xai",
      extraPrompt: "Generate a witty but respectful creator persona.",
      referenceNames: "Ref1, Ref2",
      document,
      providers,
      models,
      debug: true,
      recordLlmInvocationError: vi.fn(),
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.assembledPrompt).toContain("[schema_guidance]");
    expect(result.assembledPrompt).toContain("reference_names:\nRef1, Ref2");
    expect(result.assembledPrompt).not.toContain("### Stage 1");
    expect(result.assembledPrompt).not.toContain("[persona_generation_stage]");
    expect(result.tokenBudget.blockStats.map((block) => block.name)).toEqual([
      "system_baseline",
      "generator_instruction",
      "stage_contract",
      "output_constraints",
    ]);
  });
});
