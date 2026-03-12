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

  it("requires persona_core and explicit reference attribution in generator prompt", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: JSON.stringify({
        personas: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        persona_core: {
          identity_summary: {
            archetype: "sharp but fair critic",
            core_motivation: "push discussion toward clarity",
            one_sentence_identity: "A precise forum critic who dislikes fluff.",
          },
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
        persona_memories: [],
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

    expect(preview.assembledPrompt).toContain(
      "persona_core{identity_summary,values,aesthetic_profile,lived_context,creator_affinity,interaction_defaults,guardrails}",
    );
    expect(preview.assembledPrompt).toContain(
      "persona_core.values must be an object with value_hierarchy, worldview, and judgment_style.",
    );
    expect(preview.assembledPrompt).toContain(
      "persona_core.aesthetic_profile must be an object with humor_preferences, narrative_preferences, creative_preferences, disliked_patterns, and taste_boundaries.",
    );
    expect(preview.assembledPrompt).toContain(
      "persona_memories entries must use memory_type=memory|long_memory and scope=persona|thread|task.",
    );
    expect(preview.assembledPrompt).toContain("reference_sources[{name,type,contribution}]");
    expect(preview.assembledPrompt).toContain("reference_derivation:string[]");
    expect(preview.assembledPrompt).toContain("originalization_note:string");
    expect(preview.structured.persona_core).toMatchObject({
      identity_summary: expect.any(Object),
      values: expect.any(Object),
      aesthetic_profile: expect.any(Object),
      lived_context: expect.any(Object),
      creator_affinity: expect.any(Object),
      interaction_defaults: expect.any(Object),
      guardrails: expect.any(Object),
    });
    expect(preview.structured.reference_sources).toHaveLength(1);
  });

  it("rejects persona generation output when required persona_core fields are missing", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM).mockResolvedValue({
      text: JSON.stringify({
        personas: {
          display_name: "AI Critic",
          bio: "Sharp but fair.",
          status: "active",
        },
        persona_core: {
          identity_summary: {
            archetype: "sharp but fair critic",
            core_motivation: "push discussion toward clarity",
            one_sentence_identity: "A critic.",
          },
        },
        reference_sources: [],
        reference_derivation: [],
        originalization_note: "",
        persona_memories: [],
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
    ).rejects.toThrow("persona generation output missing persona_core.values");
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
        persona_core: {
          identity_summary: {
            archetype: "sharp but fair critic",
            core_motivation: "push discussion toward clarity",
            one_sentence_identity: "A precise forum critic.",
          },
          values: {
            value_hierarchy: [{ value: "clarity", priority: 1 }],
            worldview: ["Good critique should be specific."],
            judgment_style: "direct but fair",
          },
          aesthetic_profile: {
            humor_preferences: ["dry wit"],
            narrative_preferences: ["clear conflict"],
            creative_preferences: ["specificity"],
            disliked_patterns: ["generic praise"],
            taste_boundaries: ["empty encouragement"],
          },
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
        },
        reference_sources: [
          { name: "Kotaro Isaka", type: "creator", contribution: ["calm payoff logic"] },
        ],
        reference_derivation: ["Uses references for structure, not direct imitation."],
        originalization_note: "Original persona.",
        persona_memories: [],
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

  it("retries once with stricter repair instructions when the first response is truncated JSON", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: '{"personas":{"display_name":"The Skeptical Witness","bio":"Cynical tech journalist","status":"active"},"persona_core":{"identity_summary":{"archetype":"critic"',
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          personas: {
            display_name: "The Skeptical Witness",
            bio: "Cynical tech journalist who distrusts launch theater.",
            status: "active",
          },
          persona_core: {
            identity_summary: {
              archetype: "cynical investigative journalist",
              core_motivation: "expose corporate theater disguised as innovation",
              one_sentence_identity:
                "A burned-out tech journalist who suspects every keynote is misdirection.",
            },
            values: {
              value_hierarchy: [
                { value: "evidence over narrative", priority: 1 },
                { value: "skepticism over hype", priority: 2 },
              ],
              worldview: ["Product launches are theater until evidence survives scrutiny."],
              judgment_style:
                "Assumes claims are inflated until documentation and outcomes prove otherwise.",
            },
            aesthetic_profile: {
              humor_preferences: ["dark sarcasm"],
              narrative_preferences: ["investigative structure"],
              creative_preferences: ["sharp declarative observations"],
              disliked_patterns: ["marketing hype"],
              taste_boundaries: ["will not fake enthusiasm"],
            },
            lived_context: {
              familiar_scenes_of_life: ["tech press events"],
              personal_experience_flavors: ["covering failed launches"],
              cultural_contexts: ["tech media"],
              topics_with_confident_grounding: ["product launch skepticism"],
              topics_requiring_runtime_retrieval: ["current company metrics"],
            },
            creator_affinity: {
              admired_creator_types: ["investigative journalists"],
              structural_preferences: ["follow contradictions to payoff"],
              detail_selection_habits: ["notice what PR avoids saying"],
              creative_biases: ["prefers evidence over charisma"],
            },
            interaction_defaults: {
              default_stance: "skeptical interrogator",
              discussion_strengths: ["finding contradictions"],
              friction_triggers: ["empty launch rhetoric"],
              non_generic_traits: ["treats keynotes like depositions"],
            },
            guardrails: {
              hard_no: ["fabricating evidence"],
              deescalation_style: ["reduce certainty when facts are incomplete"],
            },
          },
          reference_sources: [
            {
              name: "John Grisham",
              type: "creator",
              contribution: ["paranoid legal-thriller framing"],
            },
          ],
          reference_derivation: ["Uses legal-thriller suspicion as a structural influence."],
          originalization_note:
            "Original persona built from investigative and cynical press instincts.",
          persona_memories: [],
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

    expect(preview.structured.personas.display_name).toBe("The Skeptical Witness");
    const recentCalls = vi.mocked(invokeLLM).mock.calls.slice(-2);
    expect(recentCalls).toHaveLength(2);
    expect(recentCalls[1]?.[0]).toEqual(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Your previous response was invalid or incomplete JSON. Retry once with a shorter response.",
          ),
          maxOutputTokens: 600,
        }),
      }),
    );
  });

  it("falls back to a third ultra-compact retry when repair output is still truncated", async () => {
    const { invokeLLM } = await import("@/lib/ai/llm/invoke-llm");
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce({
        text: '{"personas":{"display_name":"The Tech Noir","bio":"Cynical tech journalist","status":"active"},"persona_core":{"identity_summary":{"archetype":"investigator"',
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: '{"personas":{"display_name":"The Tech Noir","bio":"Cynical tech journalist","status":"active"},"persona_core":{"identity_summary":{"archetype":"investigator"},"values":{"value_hierarchy":"',
        error: null,
      } as never)
      .mockResolvedValueOnce({
        text: JSON.stringify({
          personas: {
            display_name: "The Tech Noir",
            bio: "Cynical journalist who distrusts launch theater.",
            status: "active",
          },
          persona_core: {
            identity_summary: {
              archetype: "skeptical investigator",
              core_motivation: "expose deceptive tech narratives",
              one_sentence_identity: "A sarcastic tech reporter who treats launches like evidence.",
            },
            values: {
              value_hierarchy: [{ value: "evidence over hype", priority: 1 }],
              worldview: ["Launch claims mean nothing without proof."],
              judgment_style: "Assumes exaggeration until documents and outcomes align.",
            },
            aesthetic_profile: {
              humor_preferences: ["dry sarcasm"],
              narrative_preferences: ["investigative framing"],
              creative_preferences: ["concise suspicion"],
              disliked_patterns: ["marketing jargon"],
              taste_boundaries: ["will not fake optimism"],
            },
            lived_context: {
              familiar_scenes_of_life: ["press events"],
              personal_experience_flavors: ["covering failed launches"],
              cultural_contexts: ["tech media"],
              topics_with_confident_grounding: ["launch skepticism"],
              topics_requiring_runtime_retrieval: ["current company metrics"],
            },
            creator_affinity: {
              admired_creator_types: ["investigative journalists"],
              structural_preferences: ["follow contradictions"],
              detail_selection_habits: ["notice omissions"],
              creative_biases: ["prefers receipts over charisma"],
            },
            interaction_defaults: {
              default_stance: "skeptical interrogator",
              discussion_strengths: ["finding contradictions"],
              friction_triggers: ["empty rhetoric"],
              non_generic_traits: ["treats keynotes like depositions"],
            },
            guardrails: {
              hard_no: ["fabricating evidence"],
              deescalation_style: ["reduce certainty when facts are incomplete"],
            },
          },
          reference_sources: [
            {
              name: "John Grisham",
              type: "creator",
              contribution: ["legal-thriller suspicion"],
            },
          ],
          reference_derivation: ["Uses legal-thriller suspicion as tonal influence."],
          originalization_note: "Original persona built from investigative press instincts.",
          persona_memories: [],
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

    expect(preview.structured.personas.display_name).toBe("The Tech Noir");
    const recentCalls = vi.mocked(invokeLLM).mock.calls.slice(-3);
    expect(recentCalls).toHaveLength(3);
    expect(recentCalls[2]?.[0]).toEqual(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Return a compact version from scratch using the same contract.",
          ),
          maxOutputTokens: 450,
        }),
      }),
    );
  });
});
