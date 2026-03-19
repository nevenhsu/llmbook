import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
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

function buildReferenceCosplaySeedStage() {
  return {
    personas: {
      display_name: "GumGumRebel",
      bio: "Straw Hat wearing pirate enthusiast who treats every forum thread like a new island to conquer.",
      status: "active",
    },
    identity_summary: {
      archetype: "Impulsive Revolutionary",
      core_motivation:
        "Becoming the Pirate King by gathering loyal crew and pursuing boundless adventure",
      one_sentence_identity:
        "A chaos-loving pirate who attacks weak arguments with the same fervor he'd punch a World Noble.",
    },
    reference_sources: [
      {
        name: "Monkey D. Luffy",
        type: "character",
        contribution: ["impulsive, anti-authority, loyalty-driven core personality"],
      },
      {
        name: "One Piece",
        type: "media_property",
        contribution: ["pirate culture and crew-as-family dynamics"],
      },
    ],
    reference_derivation: ["Translated Luffy's verbal tics into forum-compatible表达"],
    originalization_note:
      "Persona designed for forum environments where anti-elitist pirate energy drives engagement.",
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
      default_stance: "Enter with a blunt reaction, then sharpen it into a clear stance.",
      discussion_strengths: ["clarify trade-offs"],
      friction_triggers: ["hype"],
      non_generic_traits: ["cuts through vague framing quickly"],
    },
    guardrails: {
      hard_no: ["manipulation"],
      deescalation_style: ["reduce certainty under ambiguity"],
    },
    voice_fingerprint: {
      opening_move: "Lead with suspicion, not neutral setup.",
      metaphor_domains: ["crime scene", "product launch", "cover-up"],
      attack_style: "sarcastic and evidence-oriented",
      praise_style: "grudging respect only after proof",
      closing_move: "Land a sting or reluctant concession.",
      forbidden_shapes: ["balanced explainer", "workshop critique"],
    },
    task_style_matrix: {
      post: {
        entry_shape: "Plant the angle early.",
        body_shape: "Column-style argument, not tutorial.",
        close_shape: "End with a sting or reluctant concession.",
        forbidden_shapes: ["newsletter tone", "advice list"],
      },
      comment: {
        entry_shape: "Sound like a live thread reply.",
        feedback_shape: "reaction -> suspicion -> concrete note -> grudging respect",
        close_shape: "Keep the close short and thread-native.",
        forbidden_shapes: ["sectioned critique", "support-macro tone"],
      },
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

function buildReferenceCosplayMemoriesStage() {
  return {
    persona_memories: [
      {
        memory_type: "long_memory",
        scope: "persona",
        memory_key: "captain_credo",
        content:
          "The captain doesn't ask for credentials before trusting his crew. He'd rather charge into the fight than stand around talking.",
        metadata: { source_reference: "Monkey D. Luffy" },
        expires_in_hours: null,
        is_canonical: true,
        importance: 1,
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

function buildMachineLabelInteractionStage() {
  return {
    interaction_defaults: {
      default_stance: "impulsive_challenge",
      discussion_strengths: ["loyal_defense", "gutsy_stand"],
      friction_triggers: ["formal_debate", "credential_waving"],
      non_generic_traits: ["hearty_laughs", "taunts_like_punches"],
    },
    guardrails: {
      hard_no: ["manipulation"],
      deescalation_style: ["reduce certainty under ambiguity"],
    },
    voice_fingerprint: {
      opening_move: "hearty_laugh_or_yell",
      metaphor_domains: ["pirate_battle", "nakama_bonds"],
      attack_style: "spineless_taunts_all_you_got",
      praise_style: "true_nakama_excited_whoops",
      closing_move: "battle_cry_or_challenge",
      forbidden_shapes: ["polite_disagree", "respectful_debate"],
    },
    task_style_matrix: {
      post: {
        entry_shape: "bold_declaration",
        body_shape: "impulsive_rant",
        close_shape: "challenge_or_battle_cry",
        forbidden_shapes: ["formal_intro", "citation_heavy"],
      },
      comment: {
        entry_shape: "mid_thread_burst",
        feedback_shape: "gutsy_rebuttal_or_whoop",
        close_shape: "loyal_stance",
        forbidden_shapes: ["polite_agreement", "logic_wall"],
      },
    },
  };
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
        voice_fingerprint: expect.objectContaining({
          opening_move: "Lead with suspicion, not neutral setup.",
        }),
        task_style_matrix: expect.objectContaining({
          post: expect.any(Object),
          comment: expect.any(Object),
        }),
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

  it("uses compact validated context for model invocation while keeping assembled prompt readable", async () => {
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

    expect(preview.assembledPrompt).toContain('"personas": {');
    expect(preview.assembledPrompt).toContain('\n  "personas": {');
    expect(invokeLLM).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            '[validated_context]\n{"personas":{"display_name":"AI Critic","bio":"Sharp but fair.","status":"active"}',
          ),
        }),
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

  it("rejects a malformed staged response when persona_core.voice_fingerprint is missing", async () => {
    await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      {
        interaction_defaults: buildInteractionAndGuardrailsStage().interaction_defaults,
        guardrails: buildInteractionAndGuardrailsStage().guardrails,
        task_style_matrix: buildInteractionAndGuardrailsStage().task_style_matrix,
      },
      {
        interaction_defaults: buildInteractionAndGuardrailsStage().interaction_defaults,
        guardrails: buildInteractionAndGuardrailsStage().guardrails,
        task_style_matrix: buildInteractionAndGuardrailsStage().task_style_matrix,
      },
      {
        interaction_defaults: buildInteractionAndGuardrailsStage().interaction_defaults,
        guardrails: buildInteractionAndGuardrailsStage().guardrails,
        task_style_matrix: buildInteractionAndGuardrailsStage().task_style_matrix,
      },
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toThrow("persona generation output missing persona_core.voice_fingerprint");
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

  it("runs a stage-local quality repair when the seed stage drifts into reference cosplay", async () => {
    const invokeLLM = await mockStageSequence([
      buildReferenceCosplaySeedStage(),
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

    expect(preview.structured.personas.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:quality-repair-1",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("reference-inspired, not reference-cosplay"),
        }),
      }),
    );
  });

  it("keeps staged preview pinned to the selected model but disables provider retries for low-latency preview runs", async () => {
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
        retries: 0,
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
          maxOutputTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.values_and_aesthetic,
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

  it("retries the interaction stage with the higher shared repair cap when Stage 4 output is truncated", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      '{"interaction_defaults":{"default_stance":"Jumps into threads with fists first, treats every argument like a boss battle"',
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
    expect(calls[4]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:interaction_and_guardrails:attempt-2",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Your previous response for stage interaction_and_guardrails was invalid or incomplete JSON. Retry once with a shorter response.",
          ),
          maxOutputTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.repairRetryCap,
        }),
      }),
    );
  });

  it("runs a stage-local quality repair when Stage 4 returns machine-label style fields", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildMachineLabelInteractionStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona_core.voice_fingerprint).toMatchObject({
      opening_move: "Lead with suspicion, not neutral setup.",
    });
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls[4]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:interaction_and_guardrails:quality-repair-1",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("failed the quality contract"),
          maxOutputTokens: PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.interaction_and_guardrails,
        }),
      }),
    );
  });

  it("fails with a typed quality error when Stage 4 quality repair still returns machine labels", async () => {
    await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildMachineLabelInteractionStage(),
      buildMachineLabelInteractionStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toMatchObject({
      name: "PersonaGenerationQualityError",
      stageName: "interaction_and_guardrails",
      issues: expect.arrayContaining([
        expect.stringContaining("interaction_defaults.default_stance"),
        expect.stringContaining("voice_fingerprint.opening_move"),
      ]),
    } satisfies Partial<PersonaGenerationQualityError>);
  });

  it("fails with a typed quality error when seed-stage quality repair still returns reference cosplay", async () => {
    await mockStageSequence([buildReferenceCosplaySeedStage(), buildReferenceCosplaySeedStage()]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toMatchObject({
      name: "PersonaGenerationQualityError",
      stageName: "seed",
      issues: expect.arrayContaining([
        expect.stringContaining("core_motivation"),
        expect.stringContaining("mixed-script artifact"),
      ]),
    } satisfies Partial<PersonaGenerationQualityError>);
  });

  it("runs a stage-local quality repair when persona_memories drift into literal reference roleplay", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildReferenceCosplayMemoriesStage(),
      buildMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona_memories[0]?.content).toBe(
      "Has a long-running bias toward precision over hype.",
    );
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(6);
    expect(calls[5]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:memories:quality-repair-1",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("literal reference roleplay"),
        }),
      }),
    );
  });

  it("fails with a typed quality error when memories-stage quality repair still returns literal reference roleplay", async () => {
    await mockStageSequence([
      buildSeedStage(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildReferenceCosplayMemoriesStage(),
      buildReferenceCosplayMemoriesStage(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      }),
    ).rejects.toMatchObject({
      name: "PersonaGenerationQualityError",
      stageName: "memories",
      issues: expect.arrayContaining([
        expect.stringContaining("persona_memories[0].content"),
        expect.stringContaining("literal reference roleplay"),
      ]),
    } satisfies Partial<PersonaGenerationQualityError>);
  });
});
