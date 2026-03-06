import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  PersonaGenerationParseError,
  type AiModelConfig,
} from "@/lib/ai/admin/control-plane-store";
import { CachedLlmRuntimeConfigProvider } from "@/lib/ai/llm/runtime-config-provider";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/tiptap-markdown", () => ({
  markdownToEditorHtml: vi.fn(() => "<p>ok</p>"),
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

describe("AdminAiControlPlaneStore.previewPersonaGeneration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requires enriched soul profile fields and in-character examples in generator prompt", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: JSON.stringify({
        personas: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        persona_souls: {
          soul_profile: {
            identityCore: {
              archetype: "sharp but fair critic",
              mbti: "INTJ",
              coreMotivation: "push discussion toward clarity",
            },
            valueHierarchy: [{ value: "clarity", priority: 1 }],
            reasoningLens: {
              primary: ["risk", "clarity"],
              secondary: ["novelty"],
              promptHint: "Assess claims through clarity and risk first.",
            },
            responseStyle: {
              tone: ["direct"],
              patterns: ["starts_with_reaction"],
              avoid: ["tutorial_lists"],
            },
            relationshipTendencies: {
              defaultStance: "supportive_but_blunt",
              trustSignals: ["specificity"],
              frictionTriggers: ["hype"],
            },
            decisionPolicy: {
              evidenceStandard: "high",
              tradeoffStyle: "balanced",
              uncertaintyHandling: "state assumptions",
              antiPatterns: ["overclaiming"],
              riskPreference: "balanced",
            },
            interactionDoctrine: {
              askVsTellRatio: "balanced",
              feedbackPrinciples: ["clarify trade-offs"],
              collaborationStance: "supportive",
            },
            languageSignature: {
              rhythm: "direct",
              preferredStructures: ["reaction", "evidence"],
              lexicalTaboos: [],
            },
            guardrails: {
              hardNo: ["manipulation"],
              deescalationRules: ["reduce certainty under ambiguity"],
            },
            agentEnactmentRules: [
              "Form a genuine reaction before writing.",
              "Do not sound like a generic assistant.",
            ],
            inCharacterExamples: [
              {
                scenario: "Someone posts vague hype.",
                response: "I do not buy it yet. Show the trade-offs.",
              },
            ],
          },
        },
        persona_memory: [],
        persona_long_memories: [],
      }),
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

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.assembledPrompt).toContain("identityCore{archetype,mbti,coreMotivation}");
    expect(preview.assembledPrompt).toContain("reasoningLens{primary,secondary,promptHint}");
    expect(preview.assembledPrompt).toContain("responseStyle{tone,patterns,avoid}");
    expect(preview.assembledPrompt).toContain(
      "relationshipTendencies{defaultStance,trustSignals,frictionTriggers}",
    );
    expect(preview.assembledPrompt).toContain("agentEnactmentRules:string[]");
    expect(preview.assembledPrompt).toContain("inCharacterExamples[{scenario,response}]");
    expect(preview.structured.persona_souls.soul_profile).toMatchObject({
      identityCore: expect.objectContaining({ mbti: "INTJ" }),
      reasoningLens: expect.any(Object),
      responseStyle: expect.any(Object),
      relationshipTendencies: expect.any(Object),
      agentEnactmentRules: expect.any(Array),
      inCharacterExamples: expect.any(Array),
    });
  });

  it("rejects persona generation output when required enriched soul fields are missing", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: JSON.stringify({
        personas: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        persona_souls: {
          soul_profile: {
            identityCore: {
              archetype: "sharp but fair critic",
              mbti: "INTJ",
              coreMotivation: "push discussion toward clarity",
            },
            valueHierarchy: [{ value: "clarity", priority: 1 }],
            decisionPolicy: {
              evidenceStandard: "high",
              tradeoffStyle: "balanced",
              uncertaintyHandling: "state assumptions",
              antiPatterns: ["overclaiming"],
              riskPreference: "balanced",
            },
            interactionDoctrine: {
              askVsTellRatio: "balanced",
              feedbackPrinciples: ["clarify trade-offs"],
              collaborationStance: "supportive",
            },
            languageSignature: {
              rhythm: "direct",
              preferredStructures: ["reaction", "evidence"],
              lexicalTaboos: [],
            },
            guardrails: {
              hardNo: ["manipulation"],
              deescalationRules: ["reduce certainty under ambiguity"],
            },
          },
        },
        persona_memory: [],
        persona_long_memories: [],
      }),
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
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toThrow("persona generation output missing persona_souls.soul_profile.reasoningLens");
  });

  it("preserves raw output when persona generation response is not valid JSON", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: "Here is a persona draft:\nName: sharp critic\nBio: hates fluff",
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

    try {
      await store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PersonaGenerationParseError);
      expect((error as PersonaGenerationParseError).rawOutput).toContain("Here is a persona draft");
    }
  });

  it("uses runtime invocation policy while keeping preview pinned to the selected model", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: JSON.stringify({
        personas: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        persona_souls: {
          soul_profile: {
            identityCore: {
              archetype: "sharp but fair critic",
              mbti: "INTJ",
              coreMotivation: "push discussion toward clarity",
            },
            valueHierarchy: [{ value: "clarity", priority: 1 }],
            reasoningLens: {
              primary: ["risk", "clarity"],
              secondary: ["novelty"],
              promptHint: "Assess claims through clarity and risk first.",
            },
            responseStyle: {
              tone: ["direct"],
              patterns: ["starts_with_reaction"],
              avoid: ["tutorial_lists"],
            },
            relationshipTendencies: {
              defaultStance: "supportive_but_blunt",
              trustSignals: ["specificity"],
              frictionTriggers: ["hype"],
            },
            decisionPolicy: {
              evidenceStandard: "high",
              tradeoffStyle: "balanced",
              uncertaintyHandling: "state assumptions",
              antiPatterns: ["overclaiming"],
              riskPreference: "balanced",
            },
            interactionDoctrine: {
              askVsTellRatio: "balanced",
              feedbackPrinciples: ["clarify trade-offs"],
              collaborationStance: "supportive",
            },
            languageSignature: {
              rhythm: "direct",
              preferredStructures: ["reaction", "evidence"],
              lexicalTaboos: [],
            },
            guardrails: {
              hardNo: ["manipulation"],
              deescalationRules: ["reduce certainty under ambiguity"],
            },
            agentEnactmentRules: [
              "Form a genuine reaction before writing.",
              "Do not sound like a generic assistant.",
            ],
            inCharacterExamples: [
              {
                scenario: "Someone posts vague hype.",
                response: "I do not buy it yet. Show the trade-offs.",
              },
            ],
          },
        },
        persona_memory: [],
        persona_long_memories: [],
      }),
      error: null,
    } as never);

    const minimaxModel: AiModelConfig = {
      ...sampleModel(),
      id: "model-minimax",
      providerId: "provider-minimax",
      modelKey: "MiniMax-M2.1",
      displayName: "MiniMax M2.1",
    };

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(CachedLlmRuntimeConfigProvider.prototype, "getConfig").mockResolvedValue({
      timeoutMs: 23_456,
      retries: 4,
      route: {
        targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }],
      },
    });
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
          id: "provider-minimax",
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
      models: [minimaxModel],
    });

    await store.previewPersonaGeneration({
      modelId: "model-minimax",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 23_456,
        retries: 4,
        routeOverride: {
          targets: [
            {
              providerId: "minimax",
              modelId: "MiniMax-M2.1",
            },
          ],
        },
      }),
    );
  });
});
