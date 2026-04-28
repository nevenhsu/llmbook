import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiAgentPersonaInteractionStageService } from "@/lib/ai/agent/execution/persona-interaction-stage-service";
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
      route: { targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }] },
      timeoutMs: 30_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async () => ({
      text: '{"markdown":"Raw stage response","need_image":false,"image_prompt":null,"image_alt":null}',
      finishReason: "stop",
      providerId: "xai",
      modelId: "grok-4-1-fast-reasoning",
      error: null,
    })),
  }),
);

vi.mock("@/lib/ai/llm/default-registry", () => ({
  createDbBackedLlmProviderRegistry,
}));

vi.mock("@/lib/ai/llm/runtime-config-provider", () => ({
  resolveLlmInvocationConfig,
}));

vi.mock("@/lib/ai/llm/invoke-llm", () => ({
  invokeLLM,
}));

function sampleDocument(): AiControlPlaneDocument {
  return {
    globalPolicyDraft: {
      systemBaseline: "baseline",
      globalPolicy: "policy",
      styleGuide: "Use a live thread voice.",
      forbiddenRules: "Do not be generic.",
    },
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
      interaction_defaults: {
        default_stance: "supportive_but_blunt",
        discussion_strengths: ["specificity first"],
        friction_triggers: ["hype"],
        non_generic_traits: ["cuts to the main weakness quickly"],
      },
      voice_fingerprint: {
        opening_move: "Lead with suspicion, not neutral setup.",
        metaphor_domains: ["crime scene"],
        attack_style: "sarcastic and evidence-oriented",
        praise_style: "grudging respect only after proof",
        closing_move: "Land a sting or reluctant concession.",
        forbidden_shapes: ["balanced explainer"],
      },
      task_style_matrix: {
        post: {
          entry_shape: "Plant the angle early.",
          body_shape: "Column-style argument, not tutorial.",
          close_shape: "End with a sting.",
          forbidden_shapes: ["newsletter tone"],
        },
        comment: {
          entry_shape: "Sound like a live thread reply.",
          feedback_shape: "reaction -> concrete note -> pointed close",
          close_shape: "Keep the close short.",
          forbidden_shapes: ["sectioned critique"],
        },
      },
      reference_sources: [{ name: "Monkey D. Luffy", type: "anime_manga_character" }],
    },
    personaMemories: [],
  };
}

function baseInput() {
  return {
    personaId: "persona-1",
    modelId: "model-1",
    taskType: "comment" as const,
    stagePurpose: "main" as const,
    taskContext: "Generate a comment about the design",
    boardContextText: "[board]\nName: Design Review",
    targetContextText: "[source_comment]\n[user]: Try simplifying the silhouette",
    document: sampleDocument(),
    providers: [sampleProvider()],
    models: [sampleModel()],
    getPersonaProfile: async () => samplePersonaProfile(),
    recordLlmInvocationError: async () => {},
  };
}

describe("AiAgentPersonaInteractionStageService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the selected LLM and returns raw output with metadata without parsing", async () => {
    const service = new AiAgentPersonaInteractionStageService();
    const result = await service.runStage({
      ...baseInput(),
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.rawText).toBe(
      '{"markdown":"Raw stage response","need_image":false,"image_prompt":null,"image_alt":null}',
    );
    expect(result.providerId).toBe("xai");
    expect(result.modelId).toBe("grok-4-1-fast-reasoning");
    expect(result.finishReason).toBe("stop");
    expect(result.assembledPrompt).toContain("[agent_voice_contract]");
    expect(result.assembledPrompt).toContain("[board_context]");
    expect(result.assembledPrompt).toContain("[target_context]");
  });

  it("maps reply stages to reply-native directives", async () => {
    const service = new AiAgentPersonaInteractionStageService();
    const result = await service.runStage({
      ...baseInput(),
      taskType: "reply",
      taskContext: "Generate a reply inside the active thread below.",
    });

    expect(result.assembledPrompt).toContain("thread reply");
    expect(result.assembledPrompt).toContain("top-level essay");
    expect(result.assembledPrompt).not.toContain("standalone top-level contribution");
  });

  it("uses lean prompt blocks for audit stage", async () => {
    const service = new AiAgentPersonaInteractionStageService();
    const result = await service.runStage({
      ...baseInput(),
      taskType: "reply",
      stagePurpose: "audit",
      taskContext: "[reply_audit]\nCheck thread continuity only.",
      boardContextText: "[board]\nProject: should be omitted",
      targetContextText: "[source_comment]\n[user]: should be omitted",
    });

    expect(result.assembledPrompt).toContain("[task_context]");
    expect(result.assembledPrompt).not.toContain("[board_context]");
    expect(result.assembledPrompt).not.toContain("[target_context]");
  });
});
