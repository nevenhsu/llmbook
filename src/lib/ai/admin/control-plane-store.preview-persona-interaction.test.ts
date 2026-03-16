import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type PromptBoardContext,
} from "@/lib/ai/admin/control-plane-store";

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
    createDbBackedLlmProviderRegistry.mockClear();
    resolveLlmInvocationConfig.mockClear();
    invokeLLM.mockClear();
    invokeLLM.mockResolvedValue({
      text: JSON.stringify({ markdown: "Preview response" }),
      finishReason: "stop",
      error: null,
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
    expect(preview.assembledPrompt).toContain("[agent_soul]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("display_name: AI Artist");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
    expect(preview.assembledPrompt).toContain("username: ai_artist");
    expect(preview.assembledPrompt).toContain("target_author: artist_2");
    expect(preview.assembledPrompt).toContain("default_stance");
    expect(preview.assembledPrompt).toContain("need_image");
    expect(preview.assembledPrompt).toContain("image_prompt");
    expect(preview.assembledPrompt).toContain("image_alt");
    expect(preview.assembledPrompt).toContain(
      "[global_policy]\nPolicy:\npolicy\nForbidden:\nforbidden",
    );
    expect(preview.markdown).toBe("Preview response");
    expect(preview.rawResponse).toBe(JSON.stringify({ markdown: "Preview response" }));
  });

  it("uses a post-shaped contract with title and body when taskType is post", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);
    invokeLLM.mockResolvedValueOnce({
      text: JSON.stringify({ title: "Preview title", body: "Preview response" }),
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
    expect(preview.assembledPrompt).toContain("[agent_soul]");
    expect(preview.assembledPrompt).toContain("[agent_memory]");
    expect(preview.assembledPrompt).toContain("[agent_relationship_context]");
    expect(preview.assembledPrompt).toContain("[agent_enactment_rules]");
    expect(preview.assembledPrompt).toContain("[agent_examples]");
    expect(preview.assembledPrompt).toContain("Short-term:");
    expect(preview.assembledPrompt).toContain("Long-term:");
    expect(preview.assembledPrompt).toContain("No relationship context available.");
    expect(preview.assembledPrompt).toContain("Scenario:");
    expect(preview.assembledPrompt).toContain("Response:");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
    expect(preview.assembledPrompt).toContain("title: string");
    expect(preview.assembledPrompt).toContain("body: string");
    expect(preview.assembledPrompt).not.toContain("markdown: string");
    expect(preview.markdown).toBe("# Preview title\n\nPreview response");
    expect(preview.rawResponse).toBe(
      JSON.stringify({ title: "Preview title", body: "Preview response" }),
    );
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
