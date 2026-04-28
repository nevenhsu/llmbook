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

describe("AiAgentPersonaInteractionService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockReset();
    resolveLlmInvocationConfig.mockReset();
    invokeLLM.mockReset();
    createDbBackedLlmProviderRegistry.mockResolvedValue({ providers: new Map() });
    resolveLlmInvocationConfig.mockResolvedValue({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    });
    invokeLLM.mockImplementation(async (input?: unknown) => {
      const prompt = String(
        (input as { modelInput?: { prompt?: string } } | undefined)?.modelInput?.prompt ?? "",
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
                    value_fit: "pass",
                    reasoning_fit: "pass",
                    discourse_fit: "pass",
                    expression_fit: "pass",
                  },
                }
              : {}),
          }),
          finishReason: "stop",
          error: null,
        };
      }
      return {
        text: JSON.stringify({ markdown: "Preview response" }),
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
    });

    expect(preview.assembledPrompt).toContain("[board_context]\n[board]\nName: Creative Lab");
    expect(preview.assembledPrompt).toContain("[target_context]\n[source_comment]");
    expect(preview.assembledPrompt).toContain("[root_post]");
    expect(preview.assembledPrompt).not.toContain("[agent_memory]");
    expect(preview.assembledPrompt).not.toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).not.toContain("target_type:");
    expect(preview.assembledPrompt).not.toContain("target_id:");
  });

  it("runs merged post_body audit and one repair loop before returning rendered final post markdown", async () => {
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          body: "Many teams think prompt quality is the main issue.",
          tags: ["#ai", "#workflow"],
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: false,
          issues: ["The body sounds generic instead of persona-specific."],
          repairGuidance: ["Open with the hidden execution boundary."],
          contentChecks: {
            angle_fidelity: "fail",
            board_fit: "pass",
            body_usefulness: "fail",
            markdown_structure: "fail",
            title_body_alignment: "fail",
          },
          personaChecks: {
            body_persona_fit: "fail",
            anti_style_compliance: "fail",
            value_fit: "fail",
            reasoning_fit: "fail",
            discourse_fit: "fail",
            expression_fit: "fail",
          },
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          body: "## The missing boundary\n\nRepair is narrow. Enforcement is not.",
          tags: ["#ai", "#workflow"],
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
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
            value_fit: "pass",
            reasoning_fit: "pass",
            discourse_fit: "pass",
            expression_fit: "pass",
          },
        }),
        finishReason: "stop",
        error: null,
      });

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
    });

    expect(invokeLLM).toHaveBeenCalledTimes(4);
    expect(preview.markdown).toContain(
      "# The workflow bug people keep mislabeling as a prompt bug",
    );
    expect(preview.markdown).toContain("#ai #workflow");
    expect(preview.markdown).toContain("## The missing boundary");
    expect(preview.rawResponse).toBe(
      JSON.stringify({
        body: "## The missing boundary\n\nRepair is narrow. Enforcement is not.",
        tags: ["#ai", "#workflow"],
        need_image: false,
        image_prompt: null,
        image_alt: null,
      }),
    );
    expect(preview.auditDiagnostics).toMatchObject({
      contract: "post_body_audit",
      status: "passed_after_repair",
      repairApplied: true,
      issues: ["The body sounds generic instead of persona-specific."],
      contentChecks: {
        angle_fidelity: "pass",
      },
      personaChecks: {
        body_persona_fit: "pass",
        value_fit: "pass",
      },
    });
  });

  it("runs reply-specific audit and repair instead of the generic persona audit path", async () => {
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          markdown:
            "Repair is important in many production systems. Workflows need to be thoughtfully designed.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: false,
          issues: [
            "The reply restarts the topic as a broad essay instead of continuing the thread.",
          ],
          repairGuidance: [
            "Keep the reply thread-native instead of widening into a general explainer.",
          ],
          checks: {
            source_comment_responsiveness: "fail",
            thread_continuity: "fail",
            forward_motion: "fail",
            non_top_level_essay_shape: "fail",
            value_fit: "fail",
            reasoning_fit: "fail",
            discourse_fit: "fail",
            expression_fit: "fail",
          },
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          markdown:
            "One concrete change is that malformed output stops going straight into the same lane as policy failure.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          checks: {
            source_comment_responsiveness: "pass",
            thread_continuity: "pass",
            forward_motion: "pass",
            non_top_level_essay_shape: "pass",
            value_fit: "pass",
            reasoning_fit: "pass",
            discourse_fit: "pass",
            expression_fit: "pass",
          },
        }),
        finishReason: "stop",
        error: null,
      });

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
    });

    expect(invokeLLM).toHaveBeenCalledTimes(4);
    expect(preview.markdown).toContain(
      "One concrete change is that malformed output stops going straight into the same lane as policy failure.",
    );
    expect(preview.auditDiagnostics).toMatchObject({
      contract: "reply_audit",
      status: "passed_after_repair",
      repairApplied: true,
      checks: {
        source_comment_responsiveness: "pass",
        non_top_level_essay_shape: "pass",
      },
    });
  });
});
