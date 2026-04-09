import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaTaskGenerator } from "@/lib/ai/agent/execution/persona-task-generator";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

function buildTask(overrides: Partial<AiAgentRecentTaskSnapshot> = {}): AiAgentRecentTaskSnapshot {
  return {
    id: overrides.id ?? "task-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "comment",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:comment-source-1:comment",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? {
      summary: "Reply to the public comment with a sharper version.",
    },
    status: overrides.status ?? "DONE",
    scheduledAt: overrides.scheduledAt ?? "2026-04-08T00:00:00.000Z",
    startedAt: overrides.startedAt ?? "2026-04-08T00:00:05.000Z",
    completedAt: overrides.completedAt ?? "2026-04-08T00:00:20.000Z",
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? null,
    leaseUntil: overrides.leaseUntil ?? null,
    resultId: overrides.resultId ?? "comment-1",
    resultType: overrides.resultType ?? "comment",
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-04-08T00:00:00.000Z",
  };
}

function buildPreviewResult(rawResponse: string): PreviewResult {
  return {
    assembledPrompt: "prompt",
    markdown: rawResponse,
    rawResponse,
    renderOk: true,
    renderError: null,
    tokenBudget: {
      maxInputTokens: 1000,
      maxOutputTokens: 600,
      estimatedInputTokens: 300,
      blockStats: [],
      compressedStages: [],
      exceeded: false,
      message: "ok",
    },
    auditDiagnostics: null,
  };
}

describe("AiAgentPersonaTaskGenerator", () => {
  it("builds shared generation context without passing mode into prompt construction", async () => {
    const buildPromptContext = vi.fn(async (input: { task: AiAgentRecentTaskSnapshot }) => {
      void input.task;
      return {
        taskType: "comment" as const,
        taskContext: "Generate the publishable comment response.",
      };
    });

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteraction: async () => buildPreviewResult('{"markdown":"first run comment"}'),
      },
    });

    const result = await service.generateFromTask({
      task: buildTask({
        status: "PENDING",
        resultId: null,
        resultType: null,
      }),
      mode: "runtime",
    });

    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "first run comment",
    });
    expect(buildPromptContext).toHaveBeenCalledTimes(1);
    expect(buildPromptContext.mock.calls[0]?.[0]).toEqual({
      task: expect.objectContaining({
        id: "task-1",
      }),
    });
  });

  it("generates output in runtime mode without requiring persisted result metadata before generation", async () => {
    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          taskType: "comment",
          taskContext: "Generate the first publishable comment.",
        }),
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteraction: async (input) => {
          void input;
          return buildPreviewResult('{"markdown":"first run comment"}');
        },
      },
    });

    const result = await service.generateFromTask({
      task: buildTask({
        status: "PENDING",
        resultId: null,
        resultType: null,
      }),
      mode: "runtime",
    });

    expect(result.mode).toBe("runtime");
    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "first run comment",
    });
  });

  it("uses the shared persona interaction runtime without any persistence side effects", async () => {
    const runPersonaInteraction = vi.fn(async () =>
      buildPreviewResult('{"markdown":"regenerated comment"}'),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          taskType: "comment",
          taskContext: "Regenerate the publishable comment response.",
        }),
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteraction,
      },
    });

    const result = await service.generateFromTask({
      task: buildTask({
        status: "FAILED",
        resultId: null,
        resultType: null,
      }),
      mode: "runtime",
    });

    expect(runPersonaInteraction).toHaveBeenCalledTimes(1);
    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "regenerated comment",
    });
  });

  it("passes preformatted board and target context text into shared generation", async () => {
    const runPersonaInteraction = vi.fn(async () =>
      buildPreviewResult('{"markdown":"regenerated comment"}'),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          taskType: "comment",
          taskContext: "Generate a reply inside the active thread below.",
          boardContextText: "[board]\nName: Creative Lab",
          targetContextText: "[source_comment]\n[artist_1]: Please be more specific.",
        }),
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteraction,
      },
    });

    await service.generateFromTask({
      task: buildTask(),
      mode: "runtime",
    });

    expect(runPersonaInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        boardContextText: "[board]\nName: Creative Lab",
        targetContextText: "[source_comment]\n[artist_1]: Please be more specific.",
      }),
    );
  });

  it("defaults generation to test mode when no runtime mode is requested", async () => {
    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          taskType: "comment",
          taskContext: "Generate the first publishable comment.",
        }),
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteraction: async (input) => {
          void input;
          return buildPreviewResult('{"markdown":"first run comment"}');
        },
      },
    });

    const result = await service.generateFromTask({
      task: buildTask({
        status: "PENDING",
        resultId: null,
        resultType: null,
      }),
    });

    expect(result.mode).toBe("preview");
    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "first run comment",
    });
  });
});
