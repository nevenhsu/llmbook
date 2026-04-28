import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaTaskGenerator } from "@/lib/ai/agent/execution/persona-task-generator";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  FlowDiagnostics,
  TextFlowKind,
  TextFlowModule,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
  TextFlowRunResult,
} from "@/lib/ai/agent/execution/flows/types";

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

function buildDiagnostics(overrides: Partial<FlowDiagnostics> = {}): FlowDiagnostics {
  return {
    finalStatus: overrides.finalStatus ?? "passed",
    terminalStage: overrides.terminalStage ?? null,
    attempts: overrides.attempts ?? [],
    stageResults: overrides.stageResults ?? [],
    gate: overrides.gate,
  };
}

function buildFlowResult(flowKind: "post"): Extract<TextFlowRunResult, { flowKind: "post" }>;
function buildFlowResult(flowKind: "comment"): Extract<TextFlowRunResult, { flowKind: "comment" }>;
function buildFlowResult(flowKind: "reply"): Extract<TextFlowRunResult, { flowKind: "reply" }>;
function buildFlowResult(flowKind: TextFlowKind): TextFlowRunResult;
function buildFlowResult(flowKind: TextFlowKind): TextFlowRunResult {
  if (flowKind === "post") {
    return {
      flowKind: "post",
      parsed: {
        selectedPostPlan: {
          title: "Plan title",
          angleSummary: "Angle",
          thesis: "Thesis",
          bodyOutline: ["A", "B", "C"],
          differenceFromRecent: ["New angle"],
        },
        postBody: {
          body: "Post body",
          tags: ["#flow"],
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        },
        renderedPost: {
          title: "Plan title",
          body: "Post body",
          tags: ["#flow"],
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        },
      },
      diagnostics: buildDiagnostics({
        gate: {
          attempted: true,
          passedCandidateIndexes: [1],
          selectedCandidateIndex: 1,
        },
      }),
    };
  }

  if (flowKind === "comment") {
    return {
      flowKind: "comment",
      parsed: {
        comment: {
          markdown: "first run comment",
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        },
      },
      diagnostics: buildDiagnostics(),
    };
  }

  return {
    flowKind: "reply",
    parsed: {
      reply: {
        markdown: "first run comment",
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
    },
    diagnostics: buildDiagnostics(),
  };
}

describe("AiAgentPersonaTaskGenerator", () => {
  it("routes reply generation through the shared flow-module registry instead of parsing raw output inline", async () => {
    const buildPromptContext = vi.fn(async (input: { task: AiAgentRecentTaskSnapshot }) => {
      void input.task;
      return {
        flowKind: "reply" as const,
        taskType: "comment" as const,
        taskContext: "Generate the publishable comment response.",
      };
    });
    const runRuntime = vi.fn(async () => ({
      promptContext: {
        flowKind: "reply" as const,
        taskType: "comment" as const,
        taskContext: "Generate the publishable comment response.",
      },
      preview: buildPreviewResult('{"markdown":"first run comment"}'),
      flowResult: buildFlowResult("reply"),
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
    }));
    const resolveFlowModule = vi.fn(() => ({
      flowKind: "reply" as const,
      runPreview: vi.fn(),
      runRuntime,
    }));

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        resolveFlowModule,
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
    expect(result.flowResult.flowKind).toBe("reply");
    expect(buildPromptContext).toHaveBeenCalledTimes(1);
    expect(resolveFlowModule).toHaveBeenCalledWith("reply");
    expect(runRuntime).toHaveBeenCalledTimes(1);
    expect(buildPromptContext.mock.calls[0]?.[0]).toEqual({
      task: expect.objectContaining({
        id: "task-1",
      }),
    });
  });

  it.each([
    {
      flowKind: "post" as const,
      expectedKind: "post" as const,
      promptContext: {
        flowKind: "post" as const,
        taskType: "post" as const,
        taskContext: "Generate the first publishable post.",
      },
      expectedOutput: {
        kind: "post" as const,
        title: "Plan title",
        body: "Post body",
        tags: ["#flow"],
      },
    },
    {
      flowKind: "comment" as const,
      expectedKind: "comment" as const,
      promptContext: {
        flowKind: "comment" as const,
        taskType: "comment" as const,
        taskContext: "Generate the first publishable comment.",
      },
      expectedOutput: {
        kind: "comment" as const,
        body: "first run comment",
      },
    },
    {
      flowKind: "reply" as const,
      expectedKind: "reply" as const,
      promptContext: {
        flowKind: "reply" as const,
        taskType: "comment" as const,
        taskContext: "Generate the first publishable reply.",
      },
      expectedOutput: {
        kind: "comment" as const,
        body: "first run comment",
      },
    },
  ])(
    "uses the shared registry for $flowKind flow generation in runtime mode",
    async ({ flowKind, expectedKind, promptContext, expectedOutput }) => {
      const resolveFlowModule = vi.fn(
        (requestedFlowKind: TextFlowKind): TextFlowModule => ({
          flowKind: requestedFlowKind,
          runPreview: vi.fn(),
          runRuntime: vi.fn(async () => ({
            promptContext,
            preview: buildPreviewResult('{"markdown":"first run comment"}'),
            flowResult: buildFlowResult(flowKind),
            modelSelection: {
              modelId: "model-1",
              providerKey: "xai",
              modelKey: "grok-4-1-fast-reasoning",
            },
            modelMetadata: {
              schema_version: 1,
            },
          })),
        }),
      );

      const service = new AiAgentPersonaTaskGenerator({
        deps: {
          buildPromptContext: async () => promptContext,
          resolveFlowModule,
        },
      });

      const result = await service.generateFromTask({
        task: buildTask({
          taskType: flowKind === "post" ? "post" : "comment",
          sourceTable: flowKind === "post" ? "posts" : "comments",
          status: "PENDING",
          resultId: null,
          resultType: null,
        }),
        mode: "runtime",
      });

      expect(result.flowResult.flowKind).toBe(expectedKind);
      expect(result.parsedOutput).toEqual(expectedOutput);
      expect(resolveFlowModule).toHaveBeenCalledWith(flowKind);
    },
  );

  it("defaults generation to preview mode when no runtime mode is requested", async () => {
    const runPreview: TextFlowModule["runPreview"] = vi.fn(async () => ({
      promptContext: {
        flowKind: "comment" as const,
        taskType: "comment" as const,
        taskContext: "Generate the first publishable comment.",
      },
      preview: buildPreviewResult('{"markdown":"first run comment"}'),
      flowResult: buildFlowResult("comment"),
      modelSelection: {
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      },
      modelMetadata: {
        schema_version: 1,
      },
    }));
    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "comment" as const,
        runPreview,
        runRuntime: vi.fn(),
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          flowKind: "comment",
          taskType: "comment",
          taskContext: "Generate the first publishable comment.",
        }),
        resolveFlowModule,
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
    expect(runPreview).toHaveBeenCalledTimes(1);
  });

  it("passes preformatted board and target context text into the resolved flow module", async () => {
    const runRuntime: TextFlowModule["runRuntime"] = vi.fn(
      async (input: TextFlowModuleRunInput): Promise<TextFlowModuleRunResult> => {
        expect(input.promptContext.boardContextText).toBe("[board]\nName: Creative Lab");
        expect(input.promptContext.targetContextText).toBe(
          "[source_comment]\n[artist_1]: Please be more specific.",
        );

        return {
          promptContext: input.promptContext,
          preview: buildPreviewResult('{"markdown":"regenerated comment"}'),
          flowResult: buildFlowResult("reply"),
          modelSelection: {
            modelId: "model-1",
            providerKey: "xai",
            modelKey: "grok-4-1-fast-reasoning",
          },
          modelMetadata: {
            schema_version: 1,
          },
        };
      },
    );
    const resolveFlowModule = vi.fn(
      (): TextFlowModule => ({
        flowKind: "reply" as const,
        runPreview: vi.fn(),
        runRuntime,
      }),
    );

    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: async () => ({
          flowKind: "reply",
          taskType: "comment",
          taskContext: "Generate a reply inside the active thread below.",
          boardContextText: "[board]\nName: Creative Lab",
          targetContextText: "[source_comment]\n[artist_1]: Please be more specific.",
        }),
        resolveFlowModule,
      },
    });

    await service.generateFromTask({
      task: buildTask(),
      mode: "runtime",
    });

    expect(runRuntime).toHaveBeenCalledTimes(1);
  });
});
