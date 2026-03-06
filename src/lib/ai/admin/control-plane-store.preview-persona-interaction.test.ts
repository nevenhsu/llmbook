import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminAiControlPlaneStore,
  type AiModelConfig,
  type PromptBoardContext,
} from "@/lib/ai/admin/control-plane-store";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/tiptap-markdown", () => ({
  markdownToEditorHtml: vi.fn(() => "<p>ok</p>"),
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

function mockPersona(store: AdminAiControlPlaneStore) {
  vi.spyOn(store, "getPersonaProfile").mockResolvedValue({
    persona: {
      id: "persona-1",
      username: "ai_artist",
      display_name: "AI Artist",
      bio: "bio",
      status: "active",
    },
    soulProfile: {
      identityCore: {
        archetype: "sharp but fair critic",
        mbti: "INTJ",
        coreMotivation: "push discussion toward clarity",
      },
      valueHierarchy: [{ value: "clarity", priority: 1 }],
      decisionPolicy: {
        evidenceStandard: "high",
        tradeoffStyle: "balanced",
        uncertaintyHandling: "state assumptions",
        antiPatterns: ["overclaiming"],
        riskPreference: "balanced",
      },
      interactionDoctrine: {
        askVsTellRatio: "balanced",
        feedbackPrinciples: ["specificity first"],
        collaborationStance: "supportive",
      },
      languageSignature: {
        rhythm: "direct",
        preferredStructures: ["reaction", "evidence"],
        lexicalTaboos: [],
      },
      guardrails: {
        hardNo: ["manipulation"],
        deescalationRules: ["reduce certainty under ambiguity"],
      },
      reasoningLens: {
        primary: ["clarity", "risk"],
        secondary: ["novelty"],
        promptHint: "Assess the clearest and safest interpretation first.",
      },
      responseStyle: {
        tone: ["direct"],
        patterns: ["starts_with_reaction"],
        avoid: ["tutorial_lists"],
      },
      relationshipTendencies: {
        defaultStance: "supportive_but_blunt",
        trustSignals: ["specificity"],
        frictionTriggers: ["hype"],
      },
      agentEnactmentRules: [
        "Form a genuine reaction before writing.",
        "Do not sound like a generic assistant.",
      ],
      inCharacterExamples: [
        {
          scenario: "An artist asks for critique.",
          response: "My first reaction is that the silhouette reads weak. Fix that before polish.",
        },
      ],
    },
    memories: [
      {
        id: "m1",
        key: "topic",
        value: "feedback",
        context_data: {},
        expires_at: null,
        created_at: "2026-03-06T00:00:00.000Z",
      },
    ],
    longMemories: [
      {
        id: "lm1",
        content: "likes concrete critique",
        importance: 0.9,
        memory_category: "knowledge",
        updated_at: "2026-03-06T00:00:00.000Z",
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
    providers: [],
    models: [sampleModel()],
  });
}

describe("AdminAiControlPlaneStore.previewPersonaInteraction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
  });

  it("keeps explicit empty target_context fallback when target info is missing", async () => {
    const store = new AdminAiControlPlaneStore();
    mockControlPlane(store);
    mockPersona(store);

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
    expect(preview.assembledPrompt).toContain("Scenario: An artist asks for critique.");
    expect(preview.assembledPrompt).toContain("Use natural conversational tone");
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
