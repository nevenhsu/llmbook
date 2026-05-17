import { describe, expect, it, vi } from "vitest";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";
import { TextFlowExecutionError } from "@/lib/ai/agent/execution/flows/types";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
  return {
    id: overrides.id ?? "task-reply-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "reply",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "comments",
    sourceId: overrides.sourceId ?? "comment-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:comment-source-1:reply",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? { summary: "Reply inside the active thread." },
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
            name: "reply_body",
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

describe("createReplyFlowModule", () => {
  it("parses a successful reply generation into the reply flow envelope", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi.fn().mockResolvedValue(
      buildPreviewResult(
        JSON.stringify({
          markdown:
            "Then make the gate show the rejected angles too, otherwise the operator still cannot tell whether novelty failed or phrasing failed.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
          metadata: { probability: 64 },
        }),
        "[task_context]\nGenerate a reply inside the active thread below.",
      ),
    );

    const result = await flowModule.runRuntime({
      task: buildTask(),
      promptContext: {
        flowKind: "reply",
        taskType: "comment",
        taskContext: "Generate a reply inside the active thread below.",
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
    expect(result.flowResult.flowKind).toBe("reply");
    if (result.flowResult.flowKind !== "reply") {
      throw new Error("expected reply flow result");
    }
    expect(result.flowResult.parsed.reply).toEqual({
      markdown:
        "Then make the gate show the rejected angles too, otherwise the operator still cannot tell whether novelty failed or phrasing failed.",
      needImage: false,
      imagePrompt: null,
      imageAlt: null,
      metadata: { probability: 64 },
    });
    expect(result.flowResult.diagnostics).toEqual({
      finalStatus: "passed",
      terminalStage: "reply_body",
      attempts: [{ stage: "reply_body", main: 1, regenerate: 0 }],
      stageResults: [{ stage: "reply_body", status: "passed" }],
    });
    expect(result.stageDebugRecords?.[0]?.displayPrompt).toContain("[task_context]");
  });

  it("regenerates once with a fresh task-context suffix after a first failure", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown:
              "Yes, and I would keep that in the preview itself so the operator does not have to infer it from the final reply.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      );

    const result = await flowModule.runPreview({
      task: buildTask(),
      promptContext: {
        flowKind: "reply",
        taskType: "comment",
        taskContext: "Generate a reply inside the active thread below.",
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
      { stage: "reply_body", main: 2, regenerate: 1 },
    ]);
  });

  it("throws a typed flow error after both attempts fail", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport still down"))
      .mockRejectedValueOnce(new Error("transport still down"));

    await expect(
      flowModule.runRuntime({
        task: buildTask(),
        promptContext: {
          flowKind: "reply",
          taskType: "comment",
          taskContext: "Generate a reply inside the active thread below.",
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
      flowKind: "reply",
      causeCategory: "transport",
      diagnostics: {
        finalStatus: "failed",
        terminalStage: "reply_body",
      },
    });
  });
});
