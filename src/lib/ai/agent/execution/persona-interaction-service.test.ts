import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiAgentPersonaInteractionService } from "@/lib/ai/agent/execution/persona-interaction-service";
import type {
  AiControlPlaneDocument,
  AiModelConfig,
  AiProviderConfig,
  PersonaProfile,
} from "@/lib/ai/admin/control-plane-contract";

const { createDbBackedLlmProviderRegistry, resolveLlmInvocationConfig, invokeLLM } = vi.hoisted(
  () => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({ providers: new Map() })),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async (...args: unknown[]) => {
      void args;
      return {
        text: JSON.stringify({ markdown: "Preview response" }),
        finishReason: "stop",
        error: null,
      };
    }),
  }),
);

vi.mock("@/lib/tiptap-markdown", () => ({
  markdownToEditorHtml: vi.fn(() => "<p>ok</p>"),
}));

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry,
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig,
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM,
  invokeLLMRaw: invokeLLM,
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

function sampleProvider(): AiProviderConfig {
  return {
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
  };
}

function sampleDocument(): AiControlPlaneDocument {
  return {
    globalPolicyDraft: {
      systemBaseline: "baseline",
      globalPolicy: "policy",
      styleGuide: "Use natural conversational tone",
      forbiddenRules: "forbidden",
    },
  };
}

function samplePersonaProfile(): PersonaProfile {
  return {
    persona: {
      id: "persona-1",
      username: "ai_artist",
      display_name: "AI Artist",
      avatar_url: null,
      bio: "bio",
      status: "active",
    },
    personaCore: {
      identity_summary: {
        archetype: "sharp but fair critic",
        core_motivation: "push discussion toward clarity",
        one_sentence_identity: "A precise visual-critique regular.",
      },
      values: {
        value_hierarchy: [{ value: "clarity", priority: 1 }],
        worldview: ["Strong critique starts from what is actually on the page."],
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
        familiar_scenes_of_life: ["critique threads"],
        personal_experience_flavors: ["visual editing"],
        cultural_contexts: ["online art communities"],
        topics_with_confident_grounding: ["critique"],
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
        discussion_strengths: ["specificity first"],
        friction_triggers: ["hype"],
        non_generic_traits: ["cuts to the main weakness quickly"],
      },
      voice_fingerprint: {
        opening_move: "Lead with suspicion, not neutral setup.",
        metaphor_domains: ["crime scene", "launch event"],
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
      guardrails: {
        hard_no: ["manipulation"],
        deescalation_style: ["reduce certainty under ambiguity"],
      },
      reference_sources: [],
      other_reference_sources: [],
      reference_derivation: [],
      originalization_note: "Original persona.",
    },
    personaMemories: [],
  };
}

function collectStagePrompts(preview: {
  stageDebugRecords?: { displayPrompt: string }[] | null;
}): string {
  return (preview.stageDebugRecords ?? []).map((r) => r.displayPrompt).join("\n---\n");
}

describe("AiAgentPersonaInteractionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockReset();
    resolveLlmInvocationConfig.mockReset();
    invokeLLM.mockReset();
    createDbBackedLlmProviderRegistry.mockResolvedValue({ providers: new Map() } as any);
    resolveLlmInvocationConfig.mockResolvedValue({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    });
    invokeLLM.mockImplementation(async (input?: unknown) => {
      const modelInput = (
        input as
          | { modelInput?: { prompt?: string; metadata?: Record<string, unknown> } }
          | undefined
      )?.modelInput;
      const prompt = String(modelInput?.prompt ?? "");
      const taskType = String(
        modelInput?.metadata?._m && typeof modelInput.metadata._m === "object"
          ? ((modelInput.metadata._m as Record<string, unknown>).taskType ?? "")
          : "",
      );

      if (
        prompt.includes("[persona_output_audit]") ||
        prompt.includes("[comment_audit]") ||
        prompt.includes("[reply_audit]") ||
        prompt.includes("[post_body_audit]")
      ) {
        return {
          text: JSON.stringify({
            passes: true,
            issues: [],
            repairGuidance: [],
            ...(prompt.includes("[comment_audit]") || prompt.includes("[reply_audit]")
              ? {
                  checks: prompt.includes("[reply_audit]")
                    ? {
                        source_comment_responsiveness: "pass",
                        thread_continuity: "pass",
                        forward_motion: "pass",
                        non_top_level_essay_shape: "pass",
                        value_fit: "pass",
                        reasoning_fit: "pass",
                        discourse_fit: "pass",
                        expression_fit: "pass",
                        procedure_fit: "pass",
                      }
                    : {
                        post_relevance: "pass",
                        net_new_value: "pass",
                        non_repetition_against_recent_comments: "pass",
                        standalone_top_level_shape: "pass",
                        value_fit: "pass",
                        reasoning_fit: "pass",
                        discourse_fit: "pass",
                        expression_fit: "pass",
                        procedure_fit: "pass",
                      },
                }
              : {
                  severity: "low",
                  confidence: 0.94,
                  missingSignals: [],
                }),
            ...(prompt.includes("[post_body_audit]")
              ? {
                  contentChecks: {
                    angle_fidelity: "pass",
                    board_fit: "pass",
                    body_usefulness: "pass",
                    markdown_structure: "pass",
                    title_body_alignment: "pass",
                  },
                  personaChecks: {
                    body_persona_fit: "pass",
                    anti_style_compliance: "pass",
                    procedure_fit: "pass",
                  },
                }
              : {}),
          }),
          finishReason: "stop",
          error: null,
        };
      }

      // Post flow stages
      if (taskType === "post_plan") {
        return {
          text: JSON.stringify({
            candidates: [
              {
                title: "Test Post",
                thesis: "Test thesis",
                body_outline: ["a", "b"],
                persona_fit_score: 80,
                novelty_score: 70,
              },
              {
                title: "Test Post 2",
                thesis: "Test thesis 2",
                body_outline: ["c", "d"],
                persona_fit_score: 75,
                novelty_score: 85,
              },
            ],
          }),
          finishReason: "stop",
          error: null,
        };
      }
      if (taskType === "post_frame") {
        return {
          text: JSON.stringify({
            main_idea: "Test idea",
            angle: "Test angle",
            beats: ["beat1", "beat2", "beat3"],
            required_details: ["d1", "d2", "d3"],
            ending_direction: "Test ending",
            tone: ["serious", "analytical"],
            avoid: ["a1", "a2", "a3"],
          }),
          finishReason: "stop",
          error: null,
        };
      }
      if (taskType === "post_body" || prompt.includes("Write the final post body")) {
        return {
          text: JSON.stringify({
            body: "Preview response body.",
            tags: ["test", "preview"],
            need_image: false,
            image_prompt: null,
            image_alt: null,
            metadata: { probability: 50 },
          }),
          finishReason: "stop",
          error: null,
        };
      }

      // Default: comment/reply markdown output
      return {
        text: JSON.stringify({
          markdown: "Preview response",
          need_image: false,
          image_prompt: null,
          image_alt: null,
          metadata: { probability: 0 },
        }),
        finishReason: "stop",
        error: null,
      };
    });
  });

  it("uses preformatted board and target context text in the shared interaction service", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Generate a reply inside the active thread below.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText:
        "[source_comment]\n[artist_1]: Please be more specific.\n\n[root_post]\nTitle: Best prompting workflows this week",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(prompts).toContain("[target_context]\n[source_comment]");
    expect(prompts).toContain("[root_post]");
    expect(prompts).not.toContain("[agent_memory]");
    expect(prompts).not.toContain("[agent_relationship_context]");
    expect(prompts).not.toContain("target_type:");
    expect(prompts).not.toContain("target_id:");
  });

  it("delegates post_body execution to raw stage service", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post_body",
      taskContext: "Write the final post body for the selected plan below.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: [
        "[selected_post_plan]",
        "Locked title: The workflow bug people keep mislabeling as a prompt bug",
        "Angle summary: Show that many prompt bugs are execution-boundary bugs.",
        "Thesis: Teams keep over-editing prompts because they never separated generation, validation, and enforcement into distinct operating steps.",
        "Body outline:",
        "- Show why prompt tuning gets blamed too early.",
        "- Contrast malformed-output repair with policy enforcement.",
        "Difference from recent:",
        "- Focuses on execution contract boundaries rather than prompt wording craft.",
        "Do not change the title or topic.",
      ].join("\n"),
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[task_context]");
    expect(prompts).toContain("Write the final post body for the selected plan below.");
    expect(preview.rawResponse).toContain("Preview response body");
    expect(preview.markdown).toContain("Preview response body");
  });

  it("puts title/content direction under [target_context] for post preview", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext:
        "Title direction: Tentacles and Madness\nContent direction: Explore cosmic horror.",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[target_context]");
    expect(prompts).toContain("Title direction: Tentacles and Madness");
    expect(prompts).toContain("Content direction: Explore cosmic horror.");
    expect(prompts).toContain("[task_context]");
    expect(prompts).toContain("Generate a new post");
  });

  it("does not leak title/content direction into [task_context] for post preview", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext:
        "Title direction: Tentacles and Madness\nContent direction: Explore cosmic horror.",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    const taskContextStart = prompts.indexOf("[task_context]");
    const targetContextStart = prompts.indexOf("[target_context]", taskContextStart + 1);
    const taskBlock =
      targetContextStart > taskContextStart
        ? prompts.slice(taskContextStart, targetContextStart)
        : prompts.slice(taskContextStart);
    expect(taskBlock).not.toContain("Title direction:");
    expect(taskBlock).not.toContain("Content direction:");
  });

  it("routes manual taskContext as targetContext for comment preview", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Write about cosmic insignificance.",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[target_context]");
    expect(prompts).toContain("Write about cosmic insignificance.");
    expect(prompts).toContain("[task_context]");
    expect(prompts).toContain("Generate a top-level comment");
  });

  it("routes manual taskContext as targetContext for reply preview", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "reply",
      taskContext: "Respond to the source comment directly.",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[target_context]");
    expect(prompts).toContain("Respond to the source comment directly.");
    expect(prompts).toContain("[task_context]");
    expect(prompts).toContain("Generate a reply");
  });

  it("still honors preformatted targetContextText over structured objects", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "ignored fallback text",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText:
        "[source_comment]\n[artist_1]: Please be more specific.\n\n[root_post]\nTitle: Best prompting workflows this week",
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(prompts).toContain("[target_context]\n[source_comment]");
    expect(prompts).toContain("[root_post]");
    expect(prompts).not.toContain("ignored fallback text");
    expect(prompts).not.toContain("target_type:");
    expect(prompts).not.toContain("target_id:");
  });

  it("routes reply taskType through flow module with diagnostics", async () => {
    const service = new AiAgentPersonaInteractionService();

    const preview = await service.run({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "reply",
      taskContext: "Generate a reply inside the active thread below.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: [
        "[root_post]",
        "Title: Best prompting workflows this week",
        "",
        "[source_comment]",
        "[artist_3]: This still sounds too vague. What exactly changes in the workflow if you add a repair step?",
        "",
        "[ancestor_comments]",
        "[artist_1]: Prompt review is useful, but most examples stop before runtime execution.",
      ].join("\n"),
      document: sampleDocument(),
      providers: [sampleProvider()],
      models: [sampleModel()],
      getPersonaProfile: async () => samplePersonaProfile(),
      recordLlmInvocationError: async () => {},
      debug: true,
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[source_comment]");
    expect(prompts).toContain("Generate a reply using the dynamic target context below");
    expect(preview.markdown).toContain("Preview response");
    expect(preview.renderOk).toBe(true);
  });
});
