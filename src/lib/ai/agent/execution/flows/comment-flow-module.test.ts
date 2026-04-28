import { describe, expect, it, vi } from "vitest";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

function buildTask(overrides: Partial<AiAgentRecentTaskSnapshot> = {}): AiAgentRecentTaskSnapshot {
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

describe("createCommentFlowModule", () => {
  it("returns first-class comment audit diagnostics in the shared flow envelope", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteraction = vi.fn().mockResolvedValueOnce({
      ...buildPreviewResult(
        JSON.stringify({
          markdown:
            "I would push this one step further: the board needs a novelty rubric, not just title filtering.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
      ),
      auditDiagnostics: {
        contract: "comment_audit",
        status: "passed_after_repair",
        issues: ["The first draft repeated a recent top-level framing too closely."],
        repairGuidance: [
          "Shift toward novelty policy instead of repeating the same workflow complaint.",
        ],
        severity: "medium",
        confidence: 0.84,
        missingSignals: [],
        repairApplied: true,
        auditMode: "compact",
        compactRetryUsed: false,
        checks: {
          post_relevance: "pass",
          net_new_value: "pass",
          non_repetition_against_recent_comments: "pass",
          standalone_top_level_shape: "pass",
          persona_fit: "pass",
          value_fit: "pass",
          reasoning_fit: "pass",
          discourse_fit: "pass",
          expression_fit: "pass",
        },
      },
    } satisfies PreviewResult);

    const result = await flowModule.runRuntime({
      task: buildTask(),
      promptContext: {
        flowKind: "comment",
        taskType: "comment",
        taskContext: "Generate a top-level comment on the post below.",
        boardContextText: "[board]\nName: Creative Lab",
        targetContextText:
          "[root_post]\nTitle: Novelty first\n\n[recent_top_level_comments]\n- [alice]: We need fresher prompts.",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteraction,
    });

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
    });
    expect(result.flowResult.diagnostics.audit).toEqual({
      contract: "comment_audit",
      status: "passed_after_repair",
      repairApplied: true,
      issues: ["The first draft repeated a recent top-level framing too closely."],
      checks: {
        post_relevance: "pass",
        net_new_value: "pass",
        non_repetition_against_recent_comments: "pass",
        standalone_top_level_shape: "pass",
        persona_fit: "pass",
        value_fit: "pass",
        reasoning_fit: "pass",
        discourse_fit: "pass",
        expression_fit: "pass",
      },
    });
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "comment.main",
        main: 1,
        schemaRepair: 0,
        repair: 1,
        regenerate: 0,
      },
    ]);
  });

  it("regenerates the comment once when the first generation attempt fails terminally", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteraction = vi
      .fn()
      .mockRejectedValueOnce(new Error("comment audit failed after repair"))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown:
              "The missing piece is board-level novelty memory, not more prompt adjectives.",
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
      runPersonaInteraction,
    });

    expect(runPersonaInteraction).toHaveBeenCalledTimes(2);
    expect(runPersonaInteraction.mock.calls[1]?.[0].taskContext).toContain("[fresh_regenerate]");
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "comment.main",
        main: 2,
        schemaRepair: 0,
        repair: 0,
        regenerate: 1,
      },
    ]);
    if (result.flowResult.flowKind !== "comment") {
      throw new Error("expected comment flow result");
    }
    expect(result.flowResult.parsed.comment.markdown).toContain("board-level novelty memory");
  });
});
