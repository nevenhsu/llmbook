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

function buildPassingSeedSemanticAudit() {
  return {
    passes: true,
    issues: [],
    repairGuidance: [],
  };
}

function buildPassingMemoriesSemanticAudit() {
  return {
    passes: true,
    issues: [],
    repairGuidance: [],
  };
}

function buildFailingSeedSemanticAudit(issue: string) {
  return {
    passes: false,
    issues: [issue],
    repairGuidance: [
      "Explain clearly how the persona becomes a new forum identity instead of restating the references.",
    ],
  };
}

function buildFailingMemoriesSemanticAudit(issue: string) {
  return {
    passes: false,
    issues: [issue],
    repairGuidance: [
      "Rewrite memories as forum-native incidents, habits, or beliefs instead of literal reference-world scenes.",
    ],
  };
}

function buildReferenceCosplaySeedStage() {
  return {
    persona: {
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

function mockStageResults(
  sequence: Array<{
    text: string;
    error?: string | null;
    finishReason?: string | null;
    attempts?: number;
  }>,
) {
  return import("@/lib/ai/llm/invoke-llm").then(({ invokeLLM }) => {
    vi.mocked(invokeLLM).mockReset();
    for (const item of sequence) {
      vi.mocked(invokeLLM).mockResolvedValueOnce({
        text: item.text,
        error: item.error ?? null,
        finishReason: item.finishReason ?? "stop",
        attempts: item.attempts ?? 1,
      } as never);
    }
    return invokeLLM;
  });
}

function withPassingSeedSemanticAudit(sequence: unknown[]) {
  return [
    sequence[0],
    buildPassingSeedSemanticAudit(),
    ...sequence.slice(1),
    buildPassingMemoriesSemanticAudit(),
  ];
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
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

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
      persona: {
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
    expect(calls).toHaveLength(7);
    expect(calls[0]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:attempt-1",
      }),
    );
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:semantic-audit-1",
      }),
    );
    expect(calls[2]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:values_and_aesthetic:attempt-1",
      }),
    );
    expect(calls[6]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:memories:semantic-audit-1",
      }),
    );
  });

  it("uses compact validated context for model invocation while keeping assembled prompt readable", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.assembledPrompt).toContain('"persona": {');
    expect(preview.assembledPrompt).toContain('\n  "persona": {');
    expect(invokeLLM).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            '[validated_context]\n{"persona":{"display_name":"AI Critic","bio":"Sharp but fair.","status":"active"}',
          ),
        }),
      }),
    );
  });

  it("rejects a malformed staged response when persona_core.values is missing", async () => {
    await mockStageSequence(
      withPassingSeedSemanticAudit([
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
      ]),
    );

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
    await mockStageSequence(
      withPassingSeedSemanticAudit([
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
      ]),
    );

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

  it("wraps seed-stage missing persona as a parse error with the original result attached", async () => {
    const missingPersonasRaw =
      '{"identity_summary":{"archetype":"critic"},"reference_sources":[{"name":"Anthony Bourdain","type":"creator","contribution":["observational candor"]}],"reference_derivation":["Observational candor adapted into forum voice."],"originalization_note":"This persona is an original identity, not roleplay."}';
    await mockStageSequence([missingPersonasRaw, missingPersonasRaw, missingPersonasRaw]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    try {
      await store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(PersonaGenerationParseError);
      expect((error as PersonaGenerationParseError).message).toBe(
        "persona generation output missing persona",
      );
      expect((error as PersonaGenerationParseError).rawOutput).toBe(missingPersonasRaw);
    }
  });

  it("uses a truncation-aware repair prompt when a stage response is cut off by length", async () => {
    const invokeLLM = await mockStageResults([
      { text: JSON.stringify(buildSeedStage()) },
      { text: JSON.stringify(buildPassingSeedSemanticAudit()) },
      { text: JSON.stringify(buildValuesAndAestheticStage()) },
      { text: JSON.stringify(buildContextAndAffinityStage()) },
      {
        text: `{"interaction_defaults":{"default_stance":"Enters discussions as an unyielding force","discussion_strengths":["Shatters surface-level reasoning"],"friction_triggers":["Surface analyses"],"non_generic_traits":["Fuses artistic deconstruction with imperial presence"]},"guardrails":{"hard_no":["Never engages with shallow arguments"],"deescalation_style":"Withdraws presence entirely rather than descend to shallow bickering."},"voice_fingerprint":{"opening_move":"I find your lack of depth disturbing","metaphor_domains":["Artistic revelation","Imperial command"],"attack_style":"Dismantles with cold precision.","praise_style":"The Force is strong with this one.","closing_move":["Leaves the shattered geometry visible"],"forbidden_shapes":["Safe conventional takes"]},"task_style_matrix":{"post":{"entry_shape":"Commands immediate attention","body_shape":"Deconstructs the subject","close_shape":"Asserts the multidimensional truth","forbidden_shapes":["Recycling accepted conclusions"]},"comment":{"entry_shape":"Cuts straight to the hidden angle","feedback_shape":"Reveals the fracture line","close_shape":"Leaves the weakness exposed","forbidden_shapes":["Soft consensus"]}`,
        finishReason: "length",
      },
      { text: JSON.stringify(buildInteractionAndGuardrailsStage()) },
      { text: JSON.stringify(buildMemoriesStage()) },
      { text: JSON.stringify(buildPassingMemoriesSemanticAudit()) },
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona_core.voice_fingerprint).toEqual(
      buildInteractionAndGuardrailsStage().voice_fingerprint,
    );
    expect(vi.mocked(invokeLLM).mock.calls[5]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:interaction_and_guardrails:attempt-2",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("was truncated before the JSON object was complete"),
        }),
      }),
    );
    expect(String(vi.mocked(invokeLLM).mock.calls[5]?.[0]?.modelInput?.prompt ?? "")).toContain(
      "Keep voice_fingerprint.closing_move as one short string, not an array.",
    );
  });

  it("feeds the truncated partial output into the first truncation repair prompt", async () => {
    const truncatedInteraction = `{"interaction_defaults":{"default_stance":"Enters discussions as an unyielding force","discussion_strengths":["Shatters surface-level reasoning"],"friction_triggers":["Surface analyses"],"non_generic_traits":["Fuses artistic deconstruction with imperial presence"]},"guardrails":{"hard_no":["Never engages with shallow arguments"],"deescalation_style":"Withdraws presence entirely rather than descend to shallow bickering."},"voice_fingerprint":{"opening_move":"I find your lack of depth disturbing","metaphor_domains":["Artistic revelation","Imperial command"],"attack_style":"Dismantles with cold precision.","praise_style":"The Force is strong with this one.","closing_move":["Leaves the shattered geometry visible"],"forbidden_shapes":["Safe conventional takes"]},"task_style_matrix":{"post":{"entry_shape":"Commands immediate attention","body_shape":"Deconstructs the subject","close_shape":"Asserts the multidimensional truth","forbidden_shapes":["Recycling accepted conclusions"]},"comment":{"entry_shape":"Cuts straight to the hidden angle","feedback_shape":"Reveals the fracture line","close_shape":"Leaves the weakness exposed","forbidden_shapes":["Soft consensus"]}`;
    const invokeLLM = await mockStageResults([
      { text: JSON.stringify(buildSeedStage()) },
      { text: JSON.stringify(buildPassingSeedSemanticAudit()) },
      { text: JSON.stringify(buildValuesAndAestheticStage()) },
      { text: JSON.stringify(buildContextAndAffinityStage()) },
      {
        text: truncatedInteraction,
        finishReason: "length",
      },
      { text: JSON.stringify(buildInteractionAndGuardrailsStage()) },
      { text: JSON.stringify(buildMemoriesStage()) },
      { text: JSON.stringify(buildPassingMemoriesSemanticAudit()) },
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    const repairPrompt = String(vi.mocked(invokeLLM).mock.calls[5]?.[0]?.modelInput?.prompt ?? "");
    expect(repairPrompt).toContain("[previous_truncated_output]");
    expect(repairPrompt).toContain(`"opening_move":"I find your lack of depth disturbing"`);
    expect(repairPrompt).toContain("Do not continue token-by-token.");
  });

  it("feeds the latest truncated partial output into the compact truncation repair prompt", async () => {
    const firstTruncatedInteraction = `{"interaction_defaults":{"default_stance":"Enters discussions as an unyielding force","discussion_strengths":["Shatters surface-level reasoning"],"friction_triggers":["Surface analyses"],"non_generic_traits":["Fuses artistic deconstruction with imperial presence"]},"guardrails":{"hard_no":["Never engages with shallow arguments"],"deescalation_style":"Withdraws presence entirely rather than descend to shallow bickering."},"voice_fingerprint":{"opening_move":"I find your lack of depth disturbing","metaphor_domains":["Artistic revelation","Imperial command"],"attack_style":"Dismantles with cold precision.","praise_style":"The Force is strong with this one.","closing_move":["Leaves the shattered geometry visible"],"forbidden_shapes":["Safe conventional takes"]},"task_style_matrix":{"post":{"entry_shape":"Commands immediate attention"}`;
    const secondTruncatedInteraction = `{"interaction_defaults":{"default_stance":"Short blunt entry.","discussion_strengths":["Expose weak framing"],"friction_triggers":["Consensus fog"],"non_generic_traits":["Cuts to the hidden angle fast"]},"guardrails":{"hard_no":["Empty swagger"],"deescalation_style":"Leaves once the point is obvious."},"voice_fingerprint":{"opening_move":"Depth first.","metaphor_domains":["fractured canvas"],"attack_style":"Calm, cold dismantling.","praise_style":"Rare gravitational respect.","closing_move":"Leaves the fracture visible.","forbidden_shapes":["soft balance"]},"task_style_matrix":{"post":{"entry_shape":"Name the deception early","body_shape":"Break the claim apart"}`;
    const invokeLLM = await mockStageResults([
      { text: JSON.stringify(buildSeedStage()) },
      { text: JSON.stringify(buildPassingSeedSemanticAudit()) },
      { text: JSON.stringify(buildValuesAndAestheticStage()) },
      { text: JSON.stringify(buildContextAndAffinityStage()) },
      {
        text: firstTruncatedInteraction,
        finishReason: "length",
      },
      {
        text: secondTruncatedInteraction,
        finishReason: "length",
      },
      { text: JSON.stringify(buildInteractionAndGuardrailsStage()) },
      { text: JSON.stringify(buildMemoriesStage()) },
      { text: JSON.stringify(buildPassingMemoriesSemanticAudit()) },
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    const compactRepairPrompt = String(
      vi.mocked(invokeLLM).mock.calls[6]?.[0]?.modelInput?.prompt ?? "",
    );
    expect(compactRepairPrompt).toContain("[previous_truncated_output]");
    expect(compactRepairPrompt).toContain(`"default_stance":"Short blunt entry."`);
    expect(compactRepairPrompt).toContain(
      "Use only 1 item in arrays unless the schema requires more.",
    );
  });

  it("runs a stage-local quality repair when the seed stage drifts into reference cosplay", async () => {
    const invokeLLM = await mockStageSequence([
      buildReferenceCosplaySeedStage(),
      buildSeedStage(),
      buildPassingSeedSemanticAudit(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
      buildPassingMemoriesSemanticAudit(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(8);
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:quality-repair-1",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining("reference-inspired, not reference-cosplay"),
        }),
      }),
    );
  });

  it("accepts a seed-stage top-level persona payload", async () => {
    await mockStageSequence(
      withPassingSeedSemanticAudit([
        JSON.stringify({
          persona: {
            display_name: "AI Critic",
            bio: "Sharp but fair.",
            status: "active",
          },
          identity_summary: {
            archetype: "critic",
            core_motivation: "Find the strongest argument.",
            one_sentence_identity: "A sharp critic who rewards rigor and rejects fluff.",
          },
          reference_sources: [
            {
              name: "Anthony Bourdain",
              type: "creator",
              contribution: ["Observational candor and lived-detail framing."],
            },
          ],
          reference_derivation: ["Turned observational candor into forum-native voice."],
          originalization_note: "Built as a forum-native critic, not literal roleplay.",
        }),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt:
        "Create a forum persona who channels Pablo Picasso's cubist mind fused with Darth Vader's commanding presence.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    expect(preview.structured.persona.bio).toBe("Sharp but fair.");
  });

  it("rejects a seed-stage top-level personas payload now that the canonical contract is singular", async () => {
    const pluralSeedRaw = JSON.stringify({
      personas: {
        display_name: "AI Critic",
        bio: "Sharp but fair.",
        status: "active",
      },
      identity_summary: {
        archetype: "critic",
        core_motivation: "Find the strongest argument.",
        one_sentence_identity: "A sharp critic who rewards rigor and rejects fluff.",
      },
      reference_sources: [
        {
          name: "Anthony Bourdain",
          type: "creator",
          contribution: ["Observational candor and lived-detail framing."],
        },
      ],
      reference_derivation: ["Turned observational candor into forum-native voice."],
      originalization_note: "Built as a forum-native critic, not literal roleplay.",
    });
    await mockStageSequence([pluralSeedRaw, pluralSeedRaw, pluralSeedRaw]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await expect(
      store.previewPersonaGeneration({
        modelId: "model-1",
        extraPrompt: "Make the persona opinionated.",
      }),
    ).rejects.toMatchObject({
      message: "persona generation output missing persona",
      rawOutput: pluralSeedRaw,
    });
  });

  it("accepts a seed-stage payload wrapped in one outer result object", async () => {
    await mockStageSequence(
      withPassingSeedSemanticAudit([
        {
          result: {
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
                type: "creator",
                contribution: ["connects scattered details into payoff"],
              },
            ],
            reference_derivation: [
              "Uses the reference for structural taste rather than direct prose imitation.",
            ],
            originalization_note:
              "This persona is an original critic, not a clone of any reference.",
          },
        },
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    expect(preview.structured.persona.bio).toBe("Sharp but fair.");
  });

  it("forces English persona-generation output in the shared staged prompt even when extraPrompt is not English", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "請生成一個偏執又銳利的論壇人格。",
    });

    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Write all persona-generation content in English, regardless of the language used in global policy text or admin extra prompt.",
          ),
        }),
      }),
    );
  });

  it("runs a seed-stage quality repair when the seed output contains non-English prose", async () => {
    const invokeLLM = await mockStageSequence([
      JSON.stringify({
        persona: {
          display_name: "深淵觀察者",
          bio: "以立體派視角審視論述的資深分析者，擅長從隱藏維度解構表面論點。",
          status: "active",
        },
        identity_summary: {
          archetype: "解構者與支配者",
          core_motivation: "透過多維度視角征服淺薄論述，並賦予深刻思考應有的影響力",
          one_sentence_identity:
            "融合立體派分析精神與強勢存在感的論壇評論者，以揭示論點隱藏面向為劍。",
        },
        reference_sources: [
          {
            name: "Pablo Picasso",
            type: "藝術家",
            contribution: ["立體派視角帶來多維度分析方法。"],
          },
          {
            name: "Darth Vader",
            type: "虛構角色",
            contribution: ["commanding presence 轉化為壓迫性的討論氣場。"],
          },
        ],
        reference_derivation: [
          "Cubist deconstruction → 將對象解構為多視角並置的分析方法",
          "Empire's rejection of weakness → 對邏輯脆弱性的不接受",
        ],
        originalization_note:
          "此人格並非直接扮演任何角色，而是萃取其核心特質並轉化為論壇上的原創身份。Picasso與Vader的特質只作為靈感來源，最後呈現的是論壇原生的批評者形象。",
      }),
      buildSeedStage(),
      buildPassingSeedSemanticAudit(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
      buildPassingMemoriesSemanticAudit(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt:
        "Create a forum persona who channels Pablo Picasso's cubist mind fused with Darth Vader's commanding presence.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    expect(vi.mocked(invokeLLM).mock.calls).toHaveLength(8);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:quality-repair-1"),
        ),
    ).toBe(true);
  });

  it("does not force a seed-stage quality repair when only the reference name is non-English inside otherwise English prose", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        JSON.stringify({
          persona: {
            display_name: "Signal Cut",
            bio: "A precise critic who treats every argument as something to be stripped down to its structure.",
            status: "active",
          },
          identity_summary: {
            archetype: "Forensic Critic",
            core_motivation: "Expose weak reasoning and preserve only what survives inspection.",
            one_sentence_identity:
              "A sharp analytical persona who turns dense discussion into clean structure and hard conclusions.",
          },
          reference_sources: [
            {
              name: "三體",
              type: "work",
              contribution: ["Cold scale and existential pressure."],
            },
          ],
          reference_derivation: [
            "Takes the scale and dread of 三體 as a tonal reference without copying its plot or characters.",
          ],
          originalization_note:
            "This persona is an original identity, not literal roleplay. It adapts the scale associated with 三體 into an English forum voice built around pressure, scrutiny, and restraint.",
        }),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Create a high-pressure analytical persona.",
    });

    expect(preview.structured.persona.display_name).toBe("Signal Cut");
    expect(vi.mocked(invokeLLM).mock.calls).toHaveLength(7);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:quality-repair-1"),
        ),
    ).toBe(false);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:semantic-audit-1"),
        ),
    ).toBe(true);
  });

  it("does not force a seed-stage quality repair when the originalization note clearly describes a transformed original identity without literal forum-native wording", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        JSON.stringify({
          persona: {
            display_name: "Cataract",
            bio: "A sharp-tongued analytical presence who treats every argument as raw material to be examined, dismantled, and either refined or discarded.",
            status: "active",
          },
          identity_summary: {
            archetype: "The Dissecting Authority",
            core_motivation:
              "To elevate discourse by forcing clarity and substance through relentless analysis",
            one_sentence_identity:
              "A commanding intellectual force who deconstructs superficial arguments with surgical precision while demanding that discourse meet the standard it pretends to hold",
          },
          reference_sources: [
            {
              name: "Pablo Picasso",
              type: "artist",
              contribution: [
                "Radical deconstruction of established forms to reveal hidden structures beneath surface appearance",
              ],
            },
            {
              name: "Darth Vader",
              type: "fictional_character",
              contribution: [
                "Controlled, economical communication that carries weight through restraint",
              ],
            },
          ],
          reference_derivation: [
            "The analytical precision of an artist who sees beneath surface presentation to structural truth",
            "The commanding weight of presence that doesn't need to raise its voice because the space itself responds",
          ],
          originalization_note:
            "This persona transforms the artistic philosophy of deconstruction into intellectual analysis, while adopting the commanding presence and measured communication style as a natural voice rather than an imitation. Rather than being Picasso or Vader, this is someone who has internalized the lesson that true mastery lies in seeing what others miss and reshaping what others accept at face value.",
        }),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt:
        "Create a forum persona who channels Pablo Picasso's cubist mind fused with Darth Vader's commanding presence.",
    });

    expect(preview.structured.persona.display_name).toBe("Cataract");
    expect(vi.mocked(invokeLLM).mock.calls).toHaveLength(7);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:quality-repair-1"),
        ),
    ).toBe(false);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:semantic-audit-1"),
        ),
    ).toBe(true);
  });

  it("does not force a seed-stage quality repair when the originalization note separates the persona from both references through generic contrast language", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        JSON.stringify({
          persona: {
            display_name: "Apex Construct",
            bio: "A relentless intellectual force who sees through the scaffolding of lazy argumentation the way a master sees flaws in a forgery.",
            status: "active",
          },
          identity_summary: {
            archetype: "The Demanding Mentor",
            core_motivation:
              "To reshape intellectual discourse by exposing superficiality and demanding genuine depth from all participants, including himself",
            one_sentence_identity:
              "An exacting analytical force who deconstructs weak arguments with artistic precision and commanding authority while seeking only substantive engagement",
          },
          reference_sources: [
            {
              name: "Pablo Picasso",
              type: "artist",
              contribution: ["Method of breaking conventional forms to reveal underlying truth"],
            },
            {
              name: "Darth Vader",
              type: "fictional_character",
              contribution: ["Commanding presence that shifts dynamics of any room without volume"],
            },
          ],
          reference_derivation: [
            "Extracted Picasso's deconstructive methodology without borrowing his artistic persona.",
            "Drew from Vader's commanding presence without borrowing domination or villainy.",
          ],
          originalization_note:
            "The resulting persona occupies a different space than either reference. Unlike Picasso's creative chaos, this figure operates with focused precision and intentionality. Unlike Vader's domination through fear, this figure commands through demonstrated intellectual superiority and the unsettling clarity of pointing out what others have missed. It is not a literal reenactment of either source, but a rigorous intellectual presence who treats every discussion as an opportunity to reach deeper truth and expects the same from others.",
        }),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt:
        "Create a forum persona who channels Pablo Picasso's cubist mind fused with Darth Vader's commanding presence.",
    });

    expect(preview.structured.persona.display_name).toBe("Apex Construct");
    expect(vi.mocked(invokeLLM).mock.calls).toHaveLength(7);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:quality-repair-1"),
        ),
    ).toBe(false);
    expect(
      vi
        .mocked(invokeLLM)
        .mock.calls.some((call) =>
          String(call[0]?.entityId ?? "").includes("seed:semantic-audit-1"),
        ),
    ).toBe(true);
  });

  it("lets the seed semantic audit trigger a quality repair even when the note uses adaptation keywords superficially", async () => {
    const invokeLLM = await mockStageSequence([
      JSON.stringify({
        persona: {
          display_name: "Stage Fright",
          bio: "A severe critic who enters threads with pressure and restraint.",
          status: "active",
        },
        identity_summary: {
          archetype: "Pressure Critic",
          core_motivation: "Force weak arguments to collapse under scrutiny.",
          one_sentence_identity:
            "A commanding critical presence that frames every exchange as a stress test for ideas.",
        },
        reference_sources: [
          {
            name: "Pablo Picasso",
            type: "artist",
            contribution: ["Breaks surfaces apart to inspect the hidden structure."],
          },
          {
            name: "Darth Vader",
            type: "fictional_character",
            contribution: ["Applies pressure through control and certainty."],
          },
        ],
        reference_derivation: [
          "Takes structural deconstruction from Picasso.",
          "Takes pressure and command from Vader.",
        ],
        originalization_note:
          "This persona is original and adapted from the references, but it keeps the same role and simply moves that energy into forum form.",
      }),
      buildFailingSeedSemanticAudit(
        "originalization_note still reads like a direct forum transfer of the references instead of a newly adapted persona identity.",
      ),
      buildSeedStage(),
      buildPassingSeedSemanticAudit(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildMemoriesStage(),
      buildPassingMemoriesSemanticAudit(),
    ]);

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt:
        "Create a forum persona who channels Pablo Picasso's cubist mind fused with Darth Vader's commanding presence.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(9);
    expect(calls[1]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:semantic-audit-1",
      }),
    );
    expect(calls[2]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:seed:quality-repair-1",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "originalization_note still reads like a direct forum transfer of the references",
          ),
        }),
      }),
    );
  });

  it("keeps staged preview pinned to the selected model but disables provider retries for low-latency preview runs", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

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
          targets: [{ providerId: "minimax", modelId: "MiniMax-M2.5" }],
        },
      }),
    );
  });

  it("retries only the failing stage with stricter repair instructions when a later staged response is truncated JSON", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(8);
    expect(
      calls.filter(
        (call) =>
          typeof call[0]?.entityId === "string" && call[0].entityId.includes(":seed:attempt-1"),
      ),
    ).toHaveLength(1);
    expect(calls[3]?.[0]).toEqual(
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
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
        '{"values":{"value_hierarchy":[{"value":"clarity","priority":1}],"worldview":["people reveal themselves"]',
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(9);
    expect(calls[4]?.[0]).toEqual(
      expect.objectContaining({
        entityId: "persona-generation-preview:model-1:values_and_aesthetic:attempt-3",
        modelInput: expect.objectContaining({
          prompt: expect.stringContaining(
            "Return a compact version from scratch using the same contract.",
          ),
          maxOutputTokens: Math.min(
            PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.compactRetryCap,
            PERSONA_GENERATION_STAGE_OUTPUT_BUDGETS.values_and_aesthetic,
          ),
        }),
      }),
    );
  });

  it("retries the interaction stage with the higher shared repair cap when Stage 4 output is truncated", async () => {
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        '{"interaction_defaults":{"default_stance":"Jumps into threads with fists first, treats every argument like a boss battle"',
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleActiveControlPlane());

    const preview = await store.previewPersonaGeneration({
      modelId: "model-1",
      extraPrompt: "Make the persona opinionated.",
    });

    expect(preview.structured.persona.display_name).toBe("AI Critic");
    const calls = vi.mocked(invokeLLM).mock.calls;
    expect(calls).toHaveLength(8);
    expect(calls[5]?.[0]).toEqual(
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
    const invokeLLM = await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildMachineLabelInteractionStage(),
        buildInteractionAndGuardrailsStage(),
        buildMemoriesStage(),
      ]),
    );

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
    expect(calls).toHaveLength(8);
    expect(calls[5]?.[0]).toEqual(
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
    await mockStageSequence(
      withPassingSeedSemanticAudit([
        buildSeedStage(),
        buildValuesAndAestheticStage(),
        buildContextAndAffinityStage(),
        buildMachineLabelInteractionStage(),
        buildMachineLabelInteractionStage(),
      ]),
    );

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
        expect.stringContaining("reference_derivation[0] must be English-only."),
        expect.stringContaining("mixed-script artifact"),
      ]),
    } satisfies Partial<PersonaGenerationQualityError>);
  });

  it("runs a stage-local quality repair when persona_memories drift into literal reference roleplay", async () => {
    const invokeLLM = await mockStageSequence([
      buildSeedStage(),
      buildPassingSeedSemanticAudit(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildReferenceCosplayMemoriesStage(),
      buildFailingMemoriesSemanticAudit(
        "persona_memories[0].content drifts into literal reference roleplay instead of a forum-native memory.",
      ),
      buildMemoriesStage(),
      buildPassingMemoriesSemanticAudit(),
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
    expect(calls).toHaveLength(9);
    expect(calls[7]?.[0]).toEqual(
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
      buildPassingSeedSemanticAudit(),
      buildValuesAndAestheticStage(),
      buildContextAndAffinityStage(),
      buildInteractionAndGuardrailsStage(),
      buildReferenceCosplayMemoriesStage(),
      buildFailingMemoriesSemanticAudit(
        "persona_memories[0].content drifts into literal reference roleplay instead of a forum-native memory.",
      ),
      buildReferenceCosplayMemoriesStage(),
      buildFailingMemoriesSemanticAudit(
        "persona_memories[0].content still reads like literal reference roleplay after repair.",
      ),
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
