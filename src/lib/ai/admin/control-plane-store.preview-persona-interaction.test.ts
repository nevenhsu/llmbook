import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type PromptBoardContext,
} from "@/lib/ai/admin/control-plane-store";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-output-audit";

const { createDbBackedLlmProviderRegistry, resolveLlmInvocationConfig, invokeLLM } = vi.hoisted(
  () => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({ providers: new Map() })),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { providerId: "xai", modelId: "grok-4-1-fast-reasoning" },
      timeoutMs: 30_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async () => ({
      text: JSON.stringify({ markdown: "Preview response" }),
      finishReason: "stop",
      error: null,
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

function sampleBoardContext(): PromptBoardContext {
  return {
    name: "Illustration Critique",
    description: "Constructive feedback for visual drafts",
    rules: [{ title: "Be specific", description: "Actionable comments only" }],
  };
}

function sampleProvider() {
  return {
    id: "provider-1",
    providerKey: "xai",
    displayName: "xAI",
    sdkPackage: "@ai-sdk/xai",
    status: "active" as const,
    testStatus: "success" as const,
    keyLast4: "1234",
    hasKey: true,
    lastApiErrorCode: null,
    lastApiErrorMessage: null,
    lastApiErrorAt: null,
    createdAt: "2026-03-06T00:00:00.000Z",
    updatedAt: "2026-03-06T00:00:00.000Z",
  };
}

function mockPersona(store: AdminAiControlPlaneStore) {
  vi.spyOn(store, "getPersonaProfile").mockResolvedValue({
    persona: {
      id: "persona-1",
      username: "ai_artist",
      display_name: "AI Artist",
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
      reference_derivation: [],
      originalization_note: "Original persona.",
    },
    personaMemories: [
      {
        id: "m1",
        memoryType: "memory",
        scope: "persona",
        memoryKey: "topic",
        content: "feedback",
        metadata: {},
        expiresAt: null,
        isCanonical: false,
        importance: null,
        createdAt: "2026-03-06T00:00:00.000Z",
        updatedAt: "2026-03-06T00:00:00.000Z",
      },
      {
        id: "lm1",
        memoryType: "long_memory",
        scope: "persona",
        memoryKey: null,
        content: "likes concrete critique",
        metadata: { memoryCategory: "knowledge" },
        expiresAt: null,
        isCanonical: true,
        importance: 0.9,
        createdAt: "2026-03-06T00:00:00.000Z",
        updatedAt: "2026-03-06T00:00:00.000Z",
      },
    ],
  });
}

function mockControlPlane(store: AdminAiControlPlaneStore) {
  vi.spyOn(store, "getActiveControlPlane").mockResolvedValue({
    release: null,
    document: {
      globalPolicyDraft: {
        systemBaseline: "baseline",
        globalPolicy: "policy",
        styleGuide: "Use natural conversational tone",
        forbiddenRules: "forbidden",
      },
    },
    providers: [sampleProvider()],
    models: [sampleModel()],
  });
}

describe("AdminAiControlPlaneStore.previewPersonaInteraction", () => {
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
    invokeLLM.mockImplementation(async (input) => {
      const prompt = String(input?.modelInput?.prompt ?? "");
      if (prompt.includes("[persona_output_audit]")) {
        return {
          text: JSON.stringify({
            passes: true,
            issues: [],
            repairGuidance: [],
            severity: "low",
            confidence: 0.94,
            missingSignals: [],
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

  it("includes post/comment image request contract and populated target_context", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Reply to the thread.",
      boardContext: sampleBoardContext(),
      targetContext: {
        targetType: "comment",
        targetId: "comment-1",
        targetAuthor: "artist_2",
        targetContent: "Try simplifying the silhouette before refining details.",
        threadSummary: "Thread is focused on stronger silhouettes.",
      },
    });

    expect(preview.assembledPrompt).toContain("[target_context]");
    expect(preview.assembledPrompt).toContain("[agent_profile]");
    expect(preview.assembledPrompt).toContain("[output_style]");
    expect(preview.assembledPrompt).toContain("[agent_core]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_voice_contract]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_anti_style_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("Compact persona summary for reply generation:");
    expect(preview.assembledPrompt).toContain("Voice fingerprint:");
    expect(preview.assembledPrompt).toContain("Comment shape expectations:");
    expect(preview.assembledPrompt).not.toContain('"identity_summary"');
    expect(preview.assembledPrompt).toContain("display_name: AI Artist");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
    expect(preview.assembledPrompt).toContain("username: ai_artist");
    expect(preview.assembledPrompt).toContain("target_author: artist_2");
    expect(preview.assembledPrompt).toContain("default_stance");
    expect(preview.assembledPrompt).toContain("React as");
    expect(preview.assembledPrompt).toContain("Do not sound like a generic assistant");
    expect(preview.assembledPrompt).toContain("need_image");
    expect(preview.assembledPrompt).toContain("image_prompt");
    expect(preview.assembledPrompt).toContain("image_alt");
    expect(preview.assembledPrompt).toContain(
      "Use the same language for the full response content.",
    );
    expect(preview.assembledPrompt).toContain(
      "Use the language explicitly specified elsewhere in this prompt; if none is specified, use English.",
    );
    expect(preview.assembledPrompt).toContain(
      "[global_policy]\nPolicy:\npolicy\nForbidden:\nforbidden",
    );
    expect(preview.markdown).toBe("Preview response");
    expect(preview.rawResponse).toBe(JSON.stringify({ markdown: "Preview response" }));
    expect(preview.auditDiagnostics).toEqual({
      status: "passed",
      issues: [],
      repairGuidance: [],
      severity: "low",
      confidence: 0.94,
      missingSignals: [],
      repairApplied: false,
      auditMode: "default",
      compactRetryUsed: false,
    });
  });

  it("uses a post-shaped contract with title and body when taskType is post", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM.mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Preview title",
        body: "Preview response",
        tags: ["#cthulhu", "#lovecraft"],
      }),
      finishReason: "stop",
      error: null,
    });

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext: "Create a new post.",
    });

    expect(preview.assembledPrompt).toContain("[target_context]");
    expect(preview.assembledPrompt).toContain("No target context available.");
    expect(preview.assembledPrompt).toContain("[output_style]");
    expect(preview.assembledPrompt).toContain("[agent_core]");
    expect(preview.assembledPrompt).toContain("[agent_voice_contract]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_anti_style_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("Compact persona summary for post generation:");
    expect(preview.assembledPrompt).toContain("Voice fingerprint:");
    expect(preview.assembledPrompt).toContain("Post shape expectations:");
    expect(preview.assembledPrompt).not.toContain('"identity_summary"');
    expect(preview.assembledPrompt).toContain("No relationship context available.");
    expect(preview.assembledPrompt).toContain("Scenario:");
    expect(preview.assembledPrompt).toContain("Response:");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
    expect(preview.assembledPrompt).toContain("title: string");
    expect(preview.assembledPrompt).toContain("body: string");
    expect(preview.assembledPrompt).toContain("tags: string[]");
    expect(preview.assembledPrompt).toContain("if none is specified, use English");
    expect(preview.assembledPrompt).not.toContain("markdown: string");
    expect(preview.markdown).toBe("# Preview title\n\n#cthulhu #lovecraft\n\nPreview response");
    expect(preview.rawResponse).toBe(
      JSON.stringify({
        title: "Preview title",
        body: "Preview response",
        tags: ["#cthulhu", "#lovecraft"],
      }),
    );
    expect(invokeLLM.mock.calls[0]?.[0]?.modelInput?.maxOutputTokens).toBe(1400);
    expect(preview.auditDiagnostics?.status).toBe("passed");
  });

  it("retries post persona audit with a compact prompt when the first audit returns empty output", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "Preview response",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: "",
        finishReason: "length",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.88,
          missingSignals: [],
        }),
        finishReason: "stop",
        error: null,
      });

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext: "Create a new post.",
    });

    expect(preview.renderOk).toBe(true);
    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(invokeLLM.mock.calls[1]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("[audit_mode]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("compact");
    expect(preview.auditDiagnostics?.auditMode).toBe("compact");
    expect(preview.auditDiagnostics?.compactRetryUsed).toBe(true);
  });

  it("retries comment persona audit with a compact prompt when the first audit returns truncated JSON", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          markdown: "Specific feedback on silhouette and atmosphere.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: '```json\n{\n  "passes": false,\n  "issues": [\n    "Persona claims inability to',
        finishReason: "length",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.91,
          missingSignals: [],
        }),
        finishReason: "stop",
        error: null,
      });

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Reply with specific creature-design feedback.",
    });

    expect(preview.renderOk).toBe(true);
    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(invokeLLM.mock.calls[1]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("compact");
    expect(preview.auditDiagnostics?.auditMode).toBe("compact");
    expect(preview.auditDiagnostics?.compactRetryUsed).toBe(true);
  });

  it("repairs invalid post output when the first response omits required tags", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "Preview response",
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "Preview response",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.9,
          missingSignals: [],
        }),
        finishReason: "stop",
        error: null,
      });

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext: "Create a new post.",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(3);
    expect(preview.renderOk).toBe(true);
    expect(preview.renderError).toBeNull();
    expect(preview.markdown).toBe("# Preview title\n\n#cthulhu #lovecraft\n\nPreview response");
    expect(preview.rawResponse).toBe(
      JSON.stringify({
        title: "Preview title",
        body: "Preview response",
        tags: ["#cthulhu", "#lovecraft"],
      }),
    );
  });

  it("repairs persona-drifted post output when the first response falls into workshop critique tone", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "What works:\n- silhouette\n- scale\n- wrongness",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: false,
          issues: ["too editorial", "persona priorities not visible"],
          repairGuidance: [
            "Lead with a sharper gut reaction.",
            "Make the persona's priorities visible in what the response defends or attacks.",
          ],
          severity: "high",
          confidence: 0.91,
          missingSignals: ["immediate reaction", "persona priorities"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "That silhouette finally hits. Keep the scale cruel and stop over-explaining the lore.",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: true,
          issues: [],
          repairGuidance: [],
          severity: "low",
          confidence: 0.86,
          missingSignals: [],
        }),
        finishReason: "stop",
        error: null,
      });

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post",
      taskContext: "Create a new post.",
    });

    expect(invokeLLM).toHaveBeenCalledTimes(4);
    expect(invokeLLM.mock.calls[1]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(invokeLLM.mock.calls[2]?.[0]?.modelInput?.prompt).toContain("[retry_persona_repair]");
    expect(invokeLLM.mock.calls[3]?.[0]?.modelInput?.prompt).toContain("[persona_output_audit]");
    expect(preview.markdown).toContain("That silhouette finally hits.");
    expect(preview.rawResponse).toContain("That silhouette finally hits.");
    expect(preview.auditDiagnostics).toEqual({
      status: "passed_after_repair",
      issues: ["too editorial", "persona priorities not visible"],
      repairGuidance: [
        "Lead with a sharper gut reaction.",
        "Make the persona's priorities visible in what the response defends or attacks.",
      ],
      severity: "high",
      confidence: 0.91,
      missingSignals: ["immediate reaction", "persona priorities"],
      repairApplied: true,
      auditMode: "default",
      compactRetryUsed: false,
    });
  });

  it("throws a typed error when repaired post output still fails persona audit", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "What works:\n- silhouette\n- scale\n- wrongness",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: false,
          issues: ["too editorial"],
          repairGuidance: ["Lead with a sharper gut reaction."],
          severity: "medium",
          confidence: 0.84,
          missingSignals: ["immediate reaction"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Preview title",
          body: "That silhouette hits. Keep the scale nasty.",
          tags: ["#cthulhu", "#lovecraft"],
        }),
        finishReason: "stop",
        error: null,
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({
          passes: false,
          issues: ["persona priorities not visible"],
          repairGuidance: ["Let the persona's priorities shape what it defends."],
          severity: "high",
          confidence: 0.9,
          missingSignals: ["persona priorities"],
        }),
        finishReason: "stop",
        error: null,
      });

    await expect(
      store.previewPersonaInteraction({
        personaId: "persona-1",
        modelId: "model-1",
        taskType: "post",
        taskContext: "Create a new post.",
      }),
    ).rejects.toMatchObject<Partial<PersonaOutputValidationError>>({
      code: "persona_repair_failed",
    });
  });

  it("uses structured vote contract with target metadata", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "vote",
      taskContext: "Decide whether to upvote or downvote.",
      targetContext: {
        targetType: "post",
        targetId: "post-1",
        targetAuthor: "artist_1",
        targetContent: "The final composition reads much better than the earlier drafts.",
        threadSummary: "Users are comparing composition iterations.",
      },
    });

    expect(preview.assembledPrompt).toContain("[output_constraints]");
    expect(preview.assembledPrompt).toContain("Return exactly one JSON object.");
    expect(preview.assembledPrompt).toContain('vote: "up" | "down"');
    expect(preview.assembledPrompt).toContain("target_type: post");
    expect(preview.assembledPrompt).not.toContain("need_image");
  });

  it("uses structured poll_post contract", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "poll_post",
      taskContext: "Create a poll about palette preference.",
    });

    expect(preview.assembledPrompt).toContain("Return exactly one JSON object.");
    expect(preview.assembledPrompt).toContain('mode: "create_poll"');
    expect(preview.assembledPrompt).toContain("options: string[]");
  });

  it("uses structured poll_vote contract with poll options", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "poll_vote",
      taskContext: "Select one poll option.",
      targetContext: {
        pollPostId: "poll-1",
        pollQuestion: "Which palette works best?",
        pollOptions: [
          { id: "opt-1", label: "Warm" },
          { id: "opt-2", label: "Cool" },
        ],
        threadSummary: "People are split between warm and cool palettes.",
      },
    });

    expect(preview.assembledPrompt).toContain("poll_post_id: poll-1");
    expect(preview.assembledPrompt).toContain("poll_question: Which palette works best?");
    expect(preview.assembledPrompt).toContain("- opt-1: Warm");
    expect(preview.assembledPrompt).toContain("Return exactly one JSON object.");
    expect(preview.assembledPrompt).toContain("selected_option_id");
  });
});
