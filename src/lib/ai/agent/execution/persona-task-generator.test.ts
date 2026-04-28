import { describe, expect, it, vi } from "vitest";
import { AiAgentPersonaTaskGenerator } from "@/lib/ai/agent/execution/persona-task-generator";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type {
  TextFlowKind,
  TextFlowModule,
  TextFlowRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";
import type { AiAgentPersonaTaskPromptContext } from "@/lib/ai/agent/execution/persona-task-context-builder";

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

function buildPersonaEvidence(): PromptPersonaEvidence {
  return {
    displayName: "Orchid",
    identity: "ai_orchid",
    referenceSourceNames: ["source-a"],
    doctrine: {
      valueFit: ["Prioritize concrete utility."],
      reasoningFit: ["Show causal boundaries."],
      discourseFit: ["Be thread-native."],
      expressionFit: ["Keep it concise."],
    },
  };
}

function buildFlowResult(flowKind: "post"): Extract<TextFlowRunResult, { flowKind: "post" }>;
function buildFlowResult(flowKind: "comment"): Extract<TextFlowRunResult, { flowKind: "comment" }>;
function buildFlowResult(flowKind: "reply"): Extract<TextFlowRunResult, { flowKind: "reply" }>;
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
      diagnostics: {
        finalStatus: "passed",
        terminalStage: "post_body",
        attempts: [],
        stageResults: [],
      },
    };
  }

  if (flowKind === "comment") {
    return {
      flowKind: "comment",
      parsed: {
        comment: {
          markdown: "This is a test comment.",
          needImage: false,
          imagePrompt: null,
          imageAlt: null,
        },
      },
      diagnostics: {
        finalStatus: "passed",
        terminalStage: "comment.main",
        attempts: [],
        stageResults: [],
      },
    };
  }

  return {
    flowKind: "reply",
    parsed: {
      reply: {
        markdown: "This is a test reply.",
        needImage: false,
        imagePrompt: null,
        imageAlt: null,
      },
    },
    diagnostics: {
      finalStatus: "passed",
      terminalStage: "reply.main",
      attempts: [],
      stageResults: [],
    },
  };
}

function buildFlowModule(flowKind: TextFlowKind): TextFlowModule {
  const flowResult =
    flowKind === "post"
      ? buildFlowResult("post")
      : flowKind === "comment"
        ? buildFlowResult("comment")
        : buildFlowResult("reply");
  const runResult = {
    promptContext: {
      flowKind,
      taskType: flowKind === "post" ? ("post" as const) : ("comment" as const),
      taskContext: "Generate output",
    },
    preview: buildPreviewResult('{"markdown":"test content"}'),
    flowResult,
    modelSelection: {
      modelId: "model-1",
      providerKey: "xai",
      modelKey: "grok-4-1-fast-reasoning",
    },
    modelMetadata: { schema_version: 1 },
  };

  return {
    flowKind,
    runPreview: vi.fn().mockResolvedValue(runResult),
    runRuntime: vi.fn().mockResolvedValue(runResult),
  };
}

describe("AiAgentPersonaTaskGenerator", () => {
  it("routes reply generation through the shared flow-module registry", async () => {
    const buildPromptContext = vi.fn(async () => ({
      flowKind: "reply" as const,
      taskType: "comment" as const,
      taskContext: "Generate the publishable comment response.",
      personaEvidence: buildPersonaEvidence(),
    }));
    const flowModule = buildFlowModule("reply");
    const resolveFlowModule = vi.fn(() => flowModule);

    const generator = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        loadPreferredTextModel: vi.fn(async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        })),
        loadPersonaEvidence: vi.fn(async () => buildPersonaEvidence()),
        runPersonaInteractionStage: vi.fn(async () => buildPreviewResult("{}")),
        resolveFlowModule,
      },
    });

    const result = await generator.generateFromTask({
      task: buildTask({ status: "PENDING", resultId: null, resultType: null }),
      mode: "runtime",
    });

    expect(result.parsedOutput).toEqual({ kind: "reply", body: "This is a test reply." });
    expect(result.flowResult.flowKind).toBe("reply");
    expect(buildPromptContext).toHaveBeenCalledTimes(1);
    expect(resolveFlowModule).toHaveBeenCalledWith("reply");
    expect(flowModule.runRuntime).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["post", "post", { kind: "post", title: "Plan title", body: "Post body", tags: ["#flow"] }],
    ["comment", "comment", { kind: "comment", body: "This is a test comment." }],
    ["reply", "reply", { kind: "reply", body: "This is a test reply." }],
  ] as const)("generates %s content", async (flowKind, expectedKind, expectedOutput) => {
    const resolveFlowModule = vi.fn(() => buildFlowModule(expectedKind));
    const buildPromptContext = vi.fn(
      async (): Promise<AiAgentPersonaTaskPromptContext> => ({
        flowKind,
        taskType: flowKind === "post" ? "post" : "comment",
        taskContext: "Generate output",
      }),
    );
    const generator = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        loadPreferredTextModel: vi.fn(async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        })),
        loadPersonaEvidence: vi.fn(async () => buildPersonaEvidence()),
        runPersonaInteractionStage: vi.fn(async () => buildPreviewResult("{}")),
        resolveFlowModule,
      },
    });

    const result = await generator.generateFromTask({
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
    expect(resolveFlowModule).toHaveBeenCalledWith(expectedKind);
  });

  it("defaults generation to preview mode when mode is omitted", async () => {
    const flowModule = buildFlowModule("comment");
    const buildPromptContext = vi.fn(
      async (): Promise<AiAgentPersonaTaskPromptContext> => ({
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Generate the first publishable comment.",
      }),
    );
    const service = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext,
        loadPersonaEvidence: vi.fn(async () => buildPersonaEvidence()),
        runPersonaInteractionStage: vi.fn(async () => buildPreviewResult("{}")),
        resolveFlowModule: vi.fn(() => flowModule),
      },
    });

    const result = await service.generateFromTask({
      task: buildTask({ status: "PENDING", resultId: null, resultType: null }),
    });

    expect(result.mode).toBe("preview");
    expect(result.parsedOutput).toEqual({
      kind: "comment",
      body: "This is a test comment.",
    });
    expect(flowModule.runPreview).toHaveBeenCalledTimes(1);
  });

  it("passes canonical persona evidence into flow modules", async () => {
    const canonicalEvidence = buildPersonaEvidence();
    const runRuntime = vi.fn(async (input: Parameters<TextFlowModule["runRuntime"]>[0]) => {
      expect(input.personaEvidence).toEqual(canonicalEvidence);
      return {
        promptContext: input.promptContext,
        preview: buildPreviewResult('{"markdown":"test content"}'),
        flowResult: buildFlowResult("comment"),
        modelSelection: {
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        },
        modelMetadata: { schema_version: 1 },
      };
    });
    const flowModule: TextFlowModule = {
      flowKind: "comment",
      runPreview: vi.fn(),
      runRuntime,
    };

    const generator = new AiAgentPersonaTaskGenerator({
      deps: {
        buildPromptContext: vi.fn(async () => ({
          flowKind: "comment" as const,
          taskType: "comment" as const,
          taskContext: "Generate output",
        })),
        loadPreferredTextModel: vi.fn(async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        })),
        loadPersonaEvidence: vi.fn(async () => canonicalEvidence),
        runPersonaInteractionStage: vi.fn(async () => buildPreviewResult("{}")),
        resolveFlowModule: vi.fn(() => flowModule),
      },
    });

    await generator.generateFromTask({
      task: buildTask({ status: "PENDING", resultId: null, resultType: null }),
      mode: "runtime",
    });

    expect(runRuntime).toHaveBeenCalledTimes(1);
  });
});
