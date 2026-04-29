import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

const { createDbBackedLlmProviderRegistry, resolveLlmInvocationConfig, invokeLLM } = vi.hoisted(
  () => ({
    createDbBackedLlmProviderRegistry: vi.fn(async () => ({ providers: new Map() })),
    resolveLlmInvocationConfig: vi.fn(async () => ({
      route: { targets: [{ providerId: "xai", modelId: "grok-4-1-fast-reasoning" }] },
      timeoutMs: 30_000,
      retries: 0,
    })),
    invokeLLM: vi.fn(async (input?: unknown) => {
      const prompt = String(
        (input as { modelInput?: { prompt?: string } } | undefined)?.modelInput?.prompt ?? "",
      );
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
            },
          }),
          finishReason: "stop",
          providerId: "xai",
          modelId: "grok-4-1-fast-reasoning",
          error: null,
        };
      }
      return {
        text: '{"markdown":"Preview response","need_image":false,"image_prompt":null,"image_alt":null}',
        finishReason: "stop",
        providerId: "xai",
        modelId: "grok-4-1-fast-reasoning",
        error: null,
      };
    }),
  }),
);

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
}));

function sampleControlPlane() {
  return {
    release: null,
    document: { globalPolicyDraft: { systemBaseline: "baseline", globalPolicy: "policy" } },
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
      identity_summary: { archetype: "thread-native critic" },
      reference_sources: [],
    },
    personaMemories: [],
  } as any;
}

describe("AdminAiControlPlaneStore interaction entrypoints", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createDbBackedLlmProviderRegistry.mockClear();
    resolveLlmInvocationConfig.mockClear();
    invokeLLM.mockClear();
  });

  it("previewPersonaInteraction routes through shared interaction service", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());

    const preview = await store.previewPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "comment",
      taskContext: "Reply to the thread.",
    });

    expect(preview.assembledPrompt).toContain("[task_context]");
    expect(preview.assembledPrompt).toContain("Reply to the thread.");
    expect(preview.rawResponse).toContain("Preview response");
    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(preview.auditDiagnostics?.contract).toBe("comment_audit");
    expect(preview.flowDiagnostics?.terminalStage).toBe("comment.main");
  });

  it("runPersonaInteraction keeps preformatted board/target blocks", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());

    const preview = await store.runPersonaInteraction({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "reply",
      taskContext: "Reply in thread.",
      boardContextText: "[board]\nName: Creative Lab",
      targetContextText: "[source_comment]\n[user]: Be specific",
    });

    expect(preview.assembledPrompt).toContain("[board_context]");
    expect(preview.assembledPrompt).toContain("Creative Lab");
    expect(preview.assembledPrompt).toContain("[target_context]");
    expect(preview.assembledPrompt).toContain("[source_comment]");
    expect(preview.rawResponse).toContain("Preview response");
    expect(preview.auditDiagnostics?.contract).toBe("reply_audit");
    expect(preview.flowDiagnostics?.terminalStage).toBe("reply.main");
  });

  it("runPersonaInteractionStage returns raw stage payload for flow modules", async () => {
    const store = new AdminAiControlPlaneStore();
    vi.spyOn(store, "getActiveControlPlane").mockResolvedValue(sampleControlPlane());
    vi.spyOn(store, "getPersonaProfile").mockResolvedValue(samplePersonaProfile());
    const preview = await store.runPersonaInteractionStage({
      personaId: "persona-1",
      modelId: "model-1",
      taskType: "post_body",
      stagePurpose: "main",
      taskContext: "Write the post body.",
    });

    expect(preview.assembledPrompt).toContain("Write the post body.");
    expect(preview.rawResponse).toContain("Preview response");
    expect(preview.auditDiagnostics).toBeNull();
  });
});
