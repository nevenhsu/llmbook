import { describe, expect, it, vi } from "vitest";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import { TextFlowExecutionError } from "@/lib/ai/agent/execution/flows/types";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    id: overrides.id ?? "task-comment-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "comment",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "posts",
    sourceId: overrides.sourceId ?? "post-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:post-source-1:comment",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? { summary: "Add a useful top-level comment." },
    status: overrides.status ?? "PENDING",
    scheduledAt: overrides.scheduledAt ?? "2026-04-10T00:00:00.000Z",
    startedAt: overrides.startedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 3,
    leaseOwner: overrides.leaseOwner ?? null,
    leaseUntil: overrides.leaseUntil ?? null,
    resultId: overrides.resultId ?? null,
    resultType: overrides.resultType ?? null,
    errorMessage: overrides.errorMessage ?? null,
    createdAt: overrides.createdAt ?? "2026-04-10T00:00:00.000Z",
  };
}

function buildPreviewResult(rawResponse: string, debugPrompt?: string): PreviewResult {
  return {
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
    stageDebugRecords: debugPrompt
      ? [
          {
            name: "comment_body",
            displayPrompt: debugPrompt,
            outputMaxTokens: 600,
            attempts: [],
          },
        ]
      : null,
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

describe("createCommentFlowModule", () => {
  it("parses a successful comment generation into the comment flow envelope", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi.fn().mockResolvedValue(
      buildPreviewResult(
        JSON.stringify({
          markdown:
            "I would push this one step further: the board needs a novelty rubric, not just title filtering.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
          metadata: { probability: 42 },
        }),
        "[task_context]\nGenerate a top-level comment on the post below.",
      ),
    );

    const result = await flowModule.runRuntime({
      task: buildTask(),
      promptContext: {
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Generate a top-level comment on the post below.",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
    });

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(1);
    expect(result.flowResult.flowKind).toBe("comment");
    if (result.flowResult.flowKind !== "comment") {
      throw new Error("expected comment flow result");
    }
    expect(result.flowResult.parsed.comment).toEqual({
      markdown:
        "I would push this one step further: the board needs a novelty rubric, not just title filtering.",
      needImage: false,
      imagePrompt: null,
      imageAlt: null,
      metadata: { probability: 42 },
    });
    expect(result.flowResult.diagnostics).toEqual({
      finalStatus: "passed",
      terminalStage: "comment_body",
      attempts: [{ stage: "comment_body", main: 1, regenerate: 0 }],
      stageResults: [{ stage: "comment_body", status: "passed" }],
    });
    expect(result.stageDebugRecords?.[0]?.displayPrompt).toContain("[task_context]");
  });

  it("regenerates once with a fresh task-context suffix after a first failure", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "The missing piece is board-level novelty memory, not more prompt adjectives.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      );

    const result = await flowModule.runPreview({
      task: buildTask(),
      promptContext: {
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Generate a top-level comment on the post below.",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
    });

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(2);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain(
      "[fresh_regenerate]",
    );
    expect(result.flowResult.diagnostics.attempts).toEqual([
      { stage: "comment_body", main: 2, regenerate: 1 },
    ]);
  });

  it("throws a typed flow error after both attempts fail", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport still down"))
      .mockRejectedValueOnce(new Error("transport still down"));

    await expect(
      flowModule.runRuntime({
        task: buildTask(),
        promptContext: {
          flowKind: "comment",
          taskType: "comment",
          taskContext: "Generate a top-level comment on the post below.",
        },
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteractionStage: runPersonaInteractionStage as any,
        personaEvidence: buildPersonaEvidence(),
      }),
    ).rejects.toMatchObject({
      name: "TextFlowExecutionError",
      flowKind: "comment",
      causeCategory: "transport",
      diagnostics: {
        finalStatus: "failed",
        terminalStage: "comment_body",
      },
    });
  });
});
