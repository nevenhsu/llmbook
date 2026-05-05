import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
  type AiModelConfig,
} from "@/lib/ai/admin/control-plane-store";

const { createDbBackedLlmProviderRegistry, invokeLLM, resolveLlmInvocationConfig } = vi.hoisted(
  () => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({})),
    invokeLLM: vi.fn(),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    })),
  }),
);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/tiptap-markdown", () => ({
  markdownToEditorHtml: vi.fn(() => "<p>ok</p>"),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry,
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM,
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig,
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

function sampleActiveControlPlane(): Awaited<
  ReturnType<AdminAiControlPlaneStore["getActiveControlPlane"]>
> {
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
    persona: {
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
        type: "real_person",
        contribution: ["Connects scattered details into payoff."],
      },
    ],
    other_reference_sources: [],
    reference_derivation: [
      "Uses the reference for structural taste rather than direct prose imitation.",
    ],
    originalization_note: "This persona is an original critic, not a clone of any reference.",
  };
}

function buildPersonaCoreStage() {
  return {
    values: {
      value_hierarchy: [{ value: "Protect clarity under pressure.", priority: 1 }],
      worldview: ["People reveal themselves in how they defend weak ideas."],
      judgment_style: "Cuts toward the operational consequence before praising the framing.",
    },
    aesthetic_profile: {
      humor_preferences: ["Dry wit when certainty outruns evidence."],
      narrative_preferences: ["Clear conflict with visible stakes."],
      creative_preferences: ["Specificity over atmosphere."],
      disliked_patterns: ["Generic praise that hides the tradeoff."],
      taste_boundaries: ["No patience for ornamental certainty."],
    },
    lived_context: {
      familiar_scenes_of_life: ["Late-night forum arguments and launch-post autopsies."],
      personal_experience_flavors: ["Years of cleaning up overconfident product claims."],
      cultural_contexts: ["Startup media and internet criticism culture."],
      topics_with_confident_grounding: ["Narrative framing, weak argument diagnosis."],
      topics_requiring_runtime_retrieval: ["Fresh company news and current market numbers."],
    },
    creator_affinity: {
      admired_creator_types: ["Writers who can turn suspicion into structure."],
      structural_preferences: ["Lead with the angle, then tighten the proof."],
      detail_selection_habits: ["Pulls the one detail that collapses the pitch."],
      creative_biases: ["Prefers compression over ornament."],
    },
    interaction_defaults: {
      default_stance: "Sounds like a sharp columnist who distrusts polish without proof.",
      discussion_strengths: ["Finds the weak premise quickly and names it cleanly."],
      friction_triggers: ["Launch-hype theater without evidence."],
      non_generic_traits: ["Moves from suspicion to one decisive concrete point."],
    },
    guardrails: {
      hard_no: ["Will not flatter hype that cannot survive inspection."],
      deescalation_style: ["Reduces certainty when the evidence is genuinely mixed."],
    },
    voice_fingerprint: {
      opening_move: "Starts by naming the one thing that feels overproduced or evasive.",
      metaphor_domains: ["Crime scenes, launch events, courtroom nerves."],
      attack_style: "Cuts through rhetorical gloss and pins the weak claim to one fact.",
      praise_style: "Offers reluctant respect only after the proof holds under pressure.",
      closing_move: "Ends with a sting, a concession, or a warning about what collapses next.",
      forbidden_shapes: ["Balanced explainer tone that hides the real angle."],
    },
    task_style_matrix: {
      post: {
        entry_shape: "Plant the angle in the first lines instead of warming up politely.",
        body_shape: "Build a column-style case around one decisive weakness or tradeoff.",
        close_shape: "Close with a sting, concession, or sharp prediction.",
        forbidden_shapes: ["Newsletter pacing or generic advice lists."],
      },
      comment: {
        entry_shape: "Reply like a live thread participant rather than an essay narrator.",
        feedback_shape: "React, isolate the weak point, then land one concrete implication.",
        close_shape: "Keep the exit short and native to the thread.",
        forbidden_shapes: ["Sectioned workshop critique or support-macro tone."],
      },
    },
  };
}

function mockStore(): AdminAiControlPlaneStore {
  const store = new AdminAiControlPlaneStore();
  vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());
  vi.spyOn(store, "recordLlmInvocationError").mockResolvedValue();
  return store;
}

function llmText(text: unknown) {
  return {
    text: typeof text === "string" ? text : JSON.stringify(text),
    finishReason: "stop",
    error: null,
  };
}

function llmRepairDelta(fields: Record<string, unknown>) {
  return llmText({ repair: fields });
}

function invokedEntityIds(): string[] {
  return invokeLLM.mock.calls.map((call) => (call[0] as { entityId?: string }).entityId ?? "");
}

function mockSuccessfulPersonaGenerationPreview() {
  invokeLLM
    .mockResolvedValueOnce(llmText(buildSeedStage()))
    .mockResolvedValueOnce(
      llmText({
        passes: true,
        keptReferenceNames: ["Kotaro Isaka"],
        issues: [],
        repairGuidance: [],
      }),
    )
    .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
    .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
    .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
    .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));
}

describe("AdminAiControlPlaneStore.previewPersonaGeneration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockReset();
    invokeLLM.mockReset();
    resolveLlmInvocationConfig.mockReset();
    createDbBackedLlmProviderRegistry.mockResolvedValue({});
    resolveLlmInvocationConfig.mockResolvedValue({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    });
  });

  it("assembles a two-stage preview without validated_context or persona_memories", async () => {
    mockSuccessfulPersonaGenerationPreview();

    const preview = await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    expect(preview.assembledPrompt).toContain("stage_name: seed");
    expect(preview.assembledPrompt).toContain("stage_name: persona_core");
    expect(preview.assembledPrompt).not.toContain("values_and_aesthetic");
    expect(preview.assembledPrompt).not.toContain("[validated_context]");
    expect(preview.markdown).not.toContain("persona_memories");
    expect(preview.structured).not.toHaveProperty("persona_memories");
    expect(preview.structured.persona_core).toMatchObject({
      identity_summary: buildSeedStage().identity_summary,
      values: buildPersonaCoreStage().values,
    });
    const semanticAuditPrompts = invokeLLM.mock.calls
      .map((call) => call[0] as { entityId?: string; modelInput?: { prompt?: string } })
      .filter((call) => call.entityId?.includes("semantic-audit"))
      .map((call) => call.modelInput?.prompt ?? "");
    expect(semanticAuditPrompts).toHaveLength(4);
    expect(semanticAuditPrompts.every((prompt) => prompt.includes("[output_constraints]"))).toBe(
      true,
    );
    for (const prompt of semanticAuditPrompts) {
      expect(prompt).toContain('"passes": true');
      expect(prompt).toContain('"issues": ["string"]');
      expect(prompt).toContain('"repairGuidance": ["string"]');
    }
    expect(
      semanticAuditPrompts.some((prompt) => prompt.includes('"keptReferenceNames": ["string"]')),
    ).toBe(true);
  });

  it("gives persona_core semantic audits enough visible output budget for reasoning models", async () => {
    mockSuccessfulPersonaGenerationPreview();

    await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    const personaCoreAuditCall = invokeLLM.mock.calls.find((call) => {
      const entityId = (call[0] as { entityId?: string }).entityId ?? "";
      return entityId.includes("persona_core:persona_core_quality_audit:semantic-audit-1");
    });
    const maxOutputTokens = (
      personaCoreAuditCall?.[0] as { modelInput?: { maxOutputTokens?: number } }
    ).modelInput?.maxOutputTokens;

    expect(maxOutputTokens).toBeGreaterThanOrEqual(2048);
  });

  it("keeps persona_core quality audit context narrow and uses low reasoning effort", async () => {
    mockSuccessfulPersonaGenerationPreview();

    await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    const personaCoreAuditCall = invokeLLM.mock.calls.find((call) => {
      const entityId = (call[0] as { entityId?: string }).entityId ?? "";
      return entityId.includes("persona_core:persona_core_quality_audit:semantic-audit-1");
    });
    const callInput = personaCoreAuditCall?.[0] as {
      modelInput?: {
        prompt?: string;
        providerOptions?: { xai?: { reasoningEffort?: string } };
      };
    };
    const parsedStage = callInput.modelInput?.prompt?.split("[parsed_stage]\n")[1] ?? "";

    expect(parsedStage).toContain("identity_anchor");
    expect(parsedStage).toContain("persona_core_focus");
    expect(parsedStage).not.toContain("reference_sources");
    expect(parsedStage).not.toContain("other_reference_sources");
    expect(parsedStage).not.toContain("reference_derivation");
    expect(callInput.modelInput?.providerOptions?.xai?.reasoningEffort).toBe("low");
  });

  it("throws a typed parse error when persona_core is missing required fields", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(
        llmText({
          ...buildPersonaCoreStage(),
          voice_fingerprint: undefined,
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          ...buildPersonaCoreStage(),
          voice_fingerprint: undefined,
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          ...buildPersonaCoreStage(),
          voice_fingerprint: undefined,
        }),
      );

    await expect(
      mockStore().previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Build a sharp forum critic.",
      }),
    ).rejects.toBeInstanceOf(PersonaGenerationParseError);
  });

  it.each([
    ["empty", ""],
    ["invalid", "not json"],
  ])(
    "treats originalization_audit with %s output as a pass instead of failing and triggering repair",
    async (_caseName, auditOutput) => {
      invokeLLM
        .mockResolvedValueOnce(llmText(buildSeedStage()))
        .mockResolvedValueOnce(
          llmText({
            passes: true,
            keptReferenceNames: ["Kotaro Isaka"],
            issues: [],
            repairGuidance: [],
          }),
        )
        .mockResolvedValueOnce(llmText(auditOutput))
        .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
        .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
        .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

      const preview = await mockStore().previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Build a sharp forum critic.",
      });

      expect(preview.structured.persona.display_name).toBe("AI Critic");
      expect(invokedEntityIds()).not.toContain(
        "persona-generation-preview:model-1:seed:quality-repair-1",
      );
    },
  );

  it("keeps the first seed quality repair compact enough to close JSON", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["originalization_note stays too close to the named references."],
          repairGuidance: ["Rewrite the note as a forum-native original identity."],
        }),
      )
      .mockResolvedValueOnce(llmRepairDelta(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

    await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a literary forum critic.",
    });

    const qualityRepairCall = invokeLLM.mock.calls.find((call) => {
      const entityId = (call[0] as { entityId?: string }).entityId ?? "";
      return entityId.includes("seed:quality-repair-1");
    });
    const prompt = (qualityRepairCall?.[0] as { modelInput?: { prompt?: string } }).modelInput
      ?.prompt;

    expect(prompt).toContain("[output]");
    expect(prompt).toContain('"repair"');
    expect(prompt).toContain("originalization_note stays too close to the named references.");
  });

  it("surfaces the parser reason when quality repair delta returns invalid JSON", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["originalization_note stays too close to the named references."],
          repairGuidance: ["Rewrite the note as a forum-native original identity."],
        }),
      )
      .mockResolvedValueOnce(llmText("not json"))
      .mockResolvedValueOnce(llmText("still not json"));

    await expect(
      mockStore().previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Build a literary forum critic.",
      }),
    ).rejects.toThrow(/quality repair delta/);
  });

  it.each([
    ["empty", ""],
    ["invalid", "not json"],
  ])(
    "treats persona_core audit with %s output as a pass instead of triggering repair",
    async (_caseName, auditOutput) => {
      invokeLLM
        .mockResolvedValueOnce(llmText(buildSeedStage()))
        .mockResolvedValueOnce(
          llmText({
            passes: true,
            keptReferenceNames: ["Kotaro Isaka"],
            issues: [],
            repairGuidance: [],
          }),
        )
        .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
        .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
        .mockResolvedValueOnce(llmText(auditOutput))
        .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

      const preview = await mockStore().previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Build a sharp forum critic.",
      });

      expect(preview.structured.persona_core.values).toEqual(buildPersonaCoreStage().values);
      expect(invokedEntityIds()).not.toContain(
        "persona-generation-preview:model-1:persona_core:quality-repair-1",
      );
    },
  );

  it("runs a persona_core quality repair when the first core output uses identifier-style labels", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["persona_core.interaction_defaults is too compressed for doctrine projection."],
          repairGuidance: ["Rewrite interaction defaults as natural-language guidance."],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(
        llmRepairDelta({ interaction_defaults: buildPersonaCoreStage().interaction_defaults }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

    const preview = await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    expect(preview.structured.persona_core.interaction_defaults).toEqual(
      buildPersonaCoreStage().interaction_defaults,
    );
    const qualityRepairCall = invokeLLM.mock.calls.find((call) => {
      const entityId = (call[0] as { entityId?: string }).entityId ?? "";
      return entityId.includes("persona_core:quality-repair-1");
    });
    expect(qualityRepairCall).toBeDefined();
  });

  it("keeps the first persona_core quality repair as a delta", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["persona_core.interaction_defaults is too compressed for doctrine projection."],
          repairGuidance: ["Rewrite interaction defaults as natural-language guidance."],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(
        llmRepairDelta({ interaction_defaults: buildPersonaCoreStage().interaction_defaults }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

    await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    const qualityRepairCall = invokeLLM.mock.calls.find((call) => {
      const entityId = (call[0] as { entityId?: string }).entityId ?? "";
      return entityId.includes("persona_core:quality-repair-1");
    });
    const prompt = (qualityRepairCall?.[0] as { modelInput?: { prompt?: string } }).modelInput
      ?.prompt;

    expect(prompt).toContain("[output]");
    expect(prompt).toContain('"repair"');
    expect(prompt).toContain("Available keys:");
    expect(prompt).toContain("persona_core.interaction_defaults is too compressed");
  });

  it("retries persona_core quality repair when first delta is invalid and recovers", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText(buildPersonaCoreStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: [
            "persona_core must stay coherent and provide enough distinct cross-field signal.",
          ],
          repairGuidance: ["Rewrite as compact but coherent persona guidance."],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText("not valid json"))
      .mockResolvedValueOnce(llmRepairDelta(buildPersonaCoreStage()))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }));

    const preview = await mockStore().previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Build a sharp forum critic.",
    });

    expect(preview.structured.persona_core.values).toEqual(buildPersonaCoreStage().values);
    expect(invokedEntityIds()).toContain(
      "persona-generation-preview:model-1:persona_core:quality-repair-2",
    );
  });

  it("throws a typed quality error when persona_core quality repair still fails", async () => {
    invokeLLM
      .mockResolvedValueOnce(llmText(buildSeedStage()))
      .mockResolvedValueOnce(
        llmText({
          passes: true,
          keptReferenceNames: ["Kotaro Isaka"],
          issues: [],
          repairGuidance: [],
        }),
      )
      .mockResolvedValueOnce(llmText({ passes: true, issues: [], repairGuidance: [] }))
      .mockResolvedValueOnce(
        llmText({
          ...buildPersonaCoreStage(),
          interaction_defaults: {
            default_stance: "hot_take_machine",
            discussion_strengths: ["fast"],
            friction_triggers: ["hype"],
            non_generic_traits: ["edgy"],
          },
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["persona_core.interaction_defaults is too compressed for doctrine projection."],
          repairGuidance: ["Rewrite interaction defaults as natural-language guidance."],
        }),
      )
      .mockResolvedValueOnce(
        llmRepairDelta({
          interaction_defaults: {
            default_stance: "hot_take_machine",
            discussion_strengths: ["fast"],
            friction_triggers: ["hype"],
            non_generic_traits: ["edgy"],
          },
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["persona_core.interaction_defaults is still too compressed."],
          repairGuidance: ["Expand interaction defaults into reusable natural-language guidance."],
        }),
      )
      .mockResolvedValueOnce(
        llmRepairDelta({
          interaction_defaults: {
            default_stance: "hot_take_machine",
            discussion_strengths: ["fast"],
            friction_triggers: ["hype"],
            non_generic_traits: ["edgy"],
          },
        }),
      )
      .mockResolvedValueOnce(
        llmText({
          passes: false,
          issues: ["persona_core.interaction_defaults is still too compressed."],
          repairGuidance: ["Expand interaction defaults into reusable natural-language guidance."],
        }),
      );

    await expect(
      mockStore().previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Build a sharp forum critic.",
      }),
    ).rejects.toBeInstanceOf(PersonaGenerationQualityError);
  });
});
