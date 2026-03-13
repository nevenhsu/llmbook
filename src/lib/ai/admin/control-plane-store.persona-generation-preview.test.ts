import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  PersonaGenerationParseError,
  type AiModelConfig,
} from "@/lib/ai/admin/control-plane-store";
import { PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS } from "@/lib/ai/admin/persona-generation-token-budgets";
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

function sampleActiveControlPlane() {
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
  };
}

function buildSeedStage() {
  return {
    personas: {
      display_name: "AI Critic",
      bio: "Sharp but fair.",
      status: "active",
    },
    identity_summary: {
      archetype: "sharp but fair critic",
      core_motivation: "push discussion toward clarity",
      one_sentence_identity: "A precise forum critic who dislikes fluff.",
    },
    reference_sources: [
      {
        name: "Kotaro Isaka",
        type: "creator",
        contribution: ["connects scattered details into payoff"],
      },
    ],
    reference_derivation: [
      "Uses the reference for structural taste rather than direct prose imitation.",
    ],
    originalization_note: "This persona is an original critic, not a clone of any reference.",
  };
}

function buildValuesAndAestheticStage() {
  return {
    values: {
      value_hierarchy: [{ value: "clarity", priority: 1 }],
      worldview: ["People reveal themselves in how they defend weak ideas."],
      judgment_style: "direct but fair",
    },
    aesthetic_profile: {
      humor_preferences: ["dry wit"],
      narrative_preferences: ["clear conflict"],
      creative_preferences: ["specificity"],
      disliked_patterns: ["generic praise"],
      taste_boundaries: ["empty encouragement"],
    },
  };
}

function buildContextAndAffinityStage() {
  return {
    lived_context: {
      familiar_scenes_of_life: ["forum critique threads"],
      personal_experience_flavors: ["editing drafts"],
      cultural_contexts: ["internet discussion culture"],
      topics_with_confident_grounding: ["story critique"],
      topics_requiring_runtime_retrieval: ["time-sensitive references"],
    },
    creator_affinity: {
      admired_creator_types: ["sharp structural critics"],
      structural_preferences: ["clear payoff"],
      detail_selection_habits: ["notice weak assumptions"],
      creative_biases: ["prefer precision over warmth"],
    },
  };
}

function buildInteractionAndGuardrailsStage() {
  return {
    interaction_defaults: {
      default_stance: "supportive_but_blunt",
      discussion_strengths: ["clarify trade-offs"],
      friction_triggers: ["hype"],
      non_generic_traits: ["cuts through vague framing quickly"],
    },
    guardrails: {
      hard_no: ["manipulation"],
      deescalation_style: ["reduce certainty under ambiguity"],
    },
  };
}

function buildMemoriesStage() {
  return {
    persona_memories: [
      {
        memory_type: "long_memory",
        scope: "persona",
        memory_key: "baseline",
        content: "Has a long-running bias toward precision over hype.",
        metadata: { source: "seed" },
        expires_in_hours: null,
        is_canonical: true,
        importance: 0.9,
      },
    ],
  };
}

function mockStageSequence(sequence: unknown[]) {
  return import("@/lib/ai/llm/invoke-llm").then(({ invokeLLM }) => {
    vi.mocked(invokeLLM).mockReset();
    for (const item of sequence) {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        text: typeof item === "string" ? item : JSON.stringify(item),
        error: null,
      } as never);
    }
    return invokeLLM;
  });
}

describe("AdminAiControlPlaneStore.previewPersonaGeneration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("runs staged persona generation and assembles the canonical payload", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.assembledPrompt).toContain("stage_name: seed");
    expect(preview.assembledPrompt).toContain("stage_name: values_and_aesthetic");
    expect(preview.assembledPrompt).toContain("stage_name: context_and_affinity");
    expect(preview.assembledPrompt).toContain("stage_name: interaction_and_guardrails");
    expect(preview.assembledPrompt).toContain("stage_name: memories");
    expect(preview.structured).toMatchObject({
      personas: {
        display_name: "AI Critic",
        bio: "Sharp but fair.",
        status: "active",
      },
      persona_core: {
        identity_summary: expect.any(Object),
        values: expect.any(Object),
        aesthetic_profile: expect.any(Object),
        lived_context: expect.any(Object),
        creator_affinity: expect.any(Object),
        interaction_defaults: expect.any(Object),
        guardrails: expect.any(Object),
      },
      reference_sources: expect.arrayContaining([
        expect.objectContaining({ name: "Kotaro Isaka" }),
      ]),
      persona_memories: expect.arrayContaining([
        expect.objectContaining({ memory_type: "long_memory" }),
      ]),
    });

    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(5);
    expect(calls[0]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:attempt-1",
      }),
    );
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:values_and_aesthetic:attempt-1",
      }),
    );
  });

  it("rejects a malformed staged response when persona_core.values is missing", async () => {
    await mockStageSequence([
      buildSeedStage(),
      {
        aesthetic_profile: buildValuesAndAestheticStage().aesthetic_profile,
      },
      {
        aesthetic_profile: buildValuesAndAestheticStage().aesthetic_profile,
      },
      {
        aesthetic_profile: buildValuesAndAestheticStage().aesthetic_profile,
      },
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toThrow("persona generation output missing persona_core.values");
  });

  it("preserves raw output when a staged persona generation response is not valid JSON", async () => {
    await mockStageSequence([
      "Here is a persona draft:\nName: sharp critic\nBio: hates fluff",
      "Here is a persona draft:\nName: sharp critic\nBio: hates fluff",
      "Here is a persona draft:\nName: sharp critic\nBio: hates fluff",
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

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

  it("uses runtime invocation policy while keeping staged preview pinned to the selected model", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
    ]);

    const minimaxModel: AiModelConfig = {
      ...sampleModel(),
      id: "model-minimax",
      providerId: "provider-minimax",
      modelKey: "MiniMax-M2.5",
      displayName: "MiniMax M2.5",
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
      ...sampleActiveControlPlane(),
      providers: [
        {
          ...sampleActiveControlPlane().providers[0],
          id: "provider-minimax",
          providerKey: "minimax",
          displayName: "Minimax",
          sdkPackage: "vercel-minimax-ai-provider",
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
              modelId: "MiniMax-M2.5",
            },
          ],
        },
      }),
    );
  });

  it("retries only the failing stage with stricter repair instructions when a later staged response is truncated JSON", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.personas.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(6);
    expect(
      calls.filter(
        (call) =>
          typeof call[0]?.entityId === "string" && call[0].entityId.includes(":seed:attempt-1"),
      ),
    ).toHaveLength(1);
    expect(calls[2]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:values_and_aesthetic:attempt-2",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Your previous response for stage values_and_aesthetic was invalid or incomplete JSON. Retry once with a shorter response.",
          ),
          maxOutputTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.repairRetryCap,
        }),
      }),
    );
  });

  it("falls back to a third ultra-compact retry on the failing stage when repair output is still truncated", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
      '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.personas.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(7);
    expect(calls[3]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:values_and_aesthetic:attempt-3",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Return a compact version from scratch using the same contract.",
          ),
          maxOutputTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.compactRetryCap,
        }),
      }),
    );
  });
});
