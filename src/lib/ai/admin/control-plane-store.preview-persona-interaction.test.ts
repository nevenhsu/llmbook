import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

const { createDbBackedLlmProviderRegistry, resolveLlmInvocationConfig, invokeLLM, invokeStructuredLLM } =
  vi.hoisted(() => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({ providers: new Map() })),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }] },
      timeoutMs: 30_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async (input?: unknown) => {
      const modelInput = (
        input as
          | { modelInput?: { prompt?: string; metadata?: Record<string, unknown> } }
          | undefined
      )?.modelInput;
      const prompt = String(modelInput?.prompt ?? "");
      if (prompt.includes("[comment_audit]")) {
        return {
          text: JSON.stringify({
            passes: true,
            issues: [],
            repairGuidance: [],
            checks: {
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
          }),
          finishReason: "stop",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        };
      }
      if (prompt.includes("[reply_audit]")) {
        return {
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
              procedure_fit: "pass",
            },
          }),
          finishReason: "stop",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        };
      }
      if (prompt.includes("[persona_output_audit]") || prompt.includes("[post_body_audit]")) {
        return {
          text: JSON.stringify({
            passes: true,
            issues: [],
            repairGuidance: [],
            severity: "low",
            confidence: 0.94,
            missingSignals: [],
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
          }),
          finishReason: "stop",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        };
      }
      if (prompt.includes("Write the final post body")) {
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
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        };
      }
      return {
        text: JSON.stringify({
          markdown: "Preview response",
          need_image: false,
          image_prompt: null,
          image_alt: null,
          metadata: { probability: 0 },
        }),
        finishReason: "stop",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        error: null,
      };
    }),
    invokeStructuredLLM: vi.fn(async (input?: unknown) => {
      const schemaName = String(
        (
          input as
            | { schemaGate?: { schemaName?: string } }
            | undefined
        )?.schemaGate?.schemaName ?? "",
      );

      if (schemaName === "PostBodyOutputSchema") {
        const value = {
          body: "Preview response",
          tags: ["preview"],
          need_image: false,
          image_prompt: null,
          image_alt: null,
          metadata: { probability: 0 },
        };
        return {
          status: "valid" as const,
          value,
          raw: {
            text: JSON.stringify(value),
            finishReason: "stop",
            providerId: "xai",
            modelId: "grok-4-1-fast-reasoning",
            error: null,
          },
          schemaGateDebug: {
            flowId: "test",
            stageId: "post_body",
            schemaName,
            status: "passed" as const,
            attempts: [],
          },
        };
      }

      const value = {
        markdown: "Preview response",
        need_image: false,
        image_prompt: null,
        image_alt: null,
        metadata: { probability: 0 },
      };
      return {
        status: "valid" as const,
        value,
        raw: {
          text: JSON.stringify(value),
          finishReason: "stop",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        },
        schemaGateDebug: {
          flowId: "test",
          stageId: schemaName === "ReplyOutputSchema" ? "reply_body" : "comment_body",
          schemaName,
          status: "passed" as const,
          attempts: [],
        },
      };
    }),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
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

vi.mock("@/lib/ai/llm/invoke-structured-llm", () => ({
  invokeStructuredLLM,
}));

function sampleControlPlane() {
  return {
    release: null,
    document: {
      globalPolicyDraft: {
        systemBaseline: "baseline",
        globalPolicy: "policy",
        styleGuide: "",
        forbiddenRules: "",
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
    models: [
      {
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
      },
    ],
  } as any;
}

function samplePersonaProfile() {
  return {
    persona: {
      id: "persona-1",
      username: "ai_test",
      display_name: "AI Test",
      status: "active",
      bio: "",
      avatar_url: null,
    },
    personaCore: {
      identity_summary: {
        archetype: "thread-native critic",
        core_motivation: "clarity",
        one_sentence_identity: "A critic.",
      },
      values: {
        value_hierarchy: [{ value: "clarity", priority: 1 }],
        worldview: [""],
        judgment_style: "fair",
      },
      aesthetic_profile: {
        humor_preferences: [""],
        narrative_preferences: [""],
        creative_preferences: [""],
        disliked_patterns: [""],
        taste_boundaries: [""],
      },
      lived_context: {
        familiar_scenes_of_life: [""],
        personal_experience_flavors: [""],
        cultural_contexts: [""],
        topics_with_confident_grounding: [""],
        topics_requiring_runtime_retrieval: [""],
      },
      creator_affinity: {
        admired_creator_types: [""],
        structural_preferences: [""],
        detail_selection_habits: [""],
        creative_biases: [""],
      },
      interaction_defaults: {
        default_stance: "supportive_but_blunt",
        discussion_strengths: [""],
        friction_triggers: [""],
        non_generic_traits: [""],
      },
      voice_fingerprint: {
        opening_move: "",
        metaphor_domains: [""],
        attack_style: "",
        praise_style: "",
        closing_move: "",
        forbidden_shapes: [""],
      },
      task_style_matrix: {
        post: { entry_shape: "", body_shape: "", close_shape: "", forbidden_shapes: [""] },
        comment: { entry_shape: "", feedback_shape: "", close_shape: "", forbidden_shapes: [""] },
      },
      guardrails: { hard_no: [""], deescalation_style: [""] },
      reference_sources: [],
      other_reference_sources: [],
      reference_derivation: [],
      originalization_note: "",
    },
    personaMemories: [],
  } as any;
}

function collectStagePrompts(preview: {
  stageDebugRecords?: { displayPrompt: string }[] | null;
}): string {
  return (preview.stageDebugRecords ?? []).map((r) => r.displayPrompt).join("\n---\n");
}

describe("AdminAiControlPlaneStore interaction entrypoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockClear();
    resolveLlmInvocationConfig.mockClear();
    invokeLLM.mockClear();
    invokeStructuredLLM.mockClear();
  });

  it("previewPersonaInteraction routes through shared interaction service", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      targetContextText: "Reply to the thread.",
      debug: true,
    } as any);

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[task_context]");
    expect(prompts).toContain("Reply to the thread.");
    expect(preview.rawResponse).toContain("Preview response");
    expect(preview.renderOk).toBe(true);
  });

  it("runPersonaInteraction keeps preformatted board/target blocks", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());

    const preview = await store.runPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "reply",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: "[source_comment]\n[user]: Be specific",
      debug: true,
    } as any);

    const prompts = collectStagePrompts(preview);
    expect(prompts).toContain("[board_context]");
    expect(prompts).toContain("Creative Lab");
    expect(prompts).toContain("[target_context]");
    expect(prompts).toContain("[source_comment]");
    expect(preview.rawResponse).toContain("Preview response");
    expect(preview.renderOk).toBe(true);
  });

  it("runPersonaInteractionStage returns raw stage payload for flow modules", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());
    const preview = await store.runPersonaInteractionStage({
      personaId: "persona-1",
      modelId: "model-1",
      flow: "post",
      stage: "post_body",
      stagePurpose: "main",
      taskContext: "Write the post body.",
    });

    expect(preview.rawResponse).toContain("Preview response");
    if (preview.stageDebugRecords?.[0]?.displayPrompt) {
      expect(preview.stageDebugRecords[0].displayPrompt).toContain(
        "Write the final post body for the selected plan and frame.",
      );
    }
  });
});
