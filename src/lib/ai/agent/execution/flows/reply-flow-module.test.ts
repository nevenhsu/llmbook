import { describe, expect, it, vi } from "vitest";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";

function buildTask(overrides: Partial<AiAgentRecentTaskSnapshot> = {}): AiAgentRecentTaskSnapshot {
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

describe("createReplyFlowModule", () => {
  it("returns first-class reply audit diagnostics in the shared flow envelope", async () => {
    const module = createReplyFlowModule();
    const runPersonaInteraction = vi.fn().mockResolvedValueOnce({
      ...buildPreviewResult(
        JSON.stringify({
          markdown:
            "Then make the gate show the rejected angles too, otherwise the operator still cannot tell whether novelty failed or phrasing failed.",
          need_image: false,
          image_prompt: null,
          image_alt: null,
        }),
      ),
      auditDiagnostics: {
        contract: "reply_audit",
        status: "passed",
        issues: [],
        repairGuidance: [],
        severity: "low",
        confidence: 0.88,
        missingSignals: [],
        repairApplied: false,
        auditMode: "compact",
        compactRetryUsed: false,
        checks: {
          source_comment_responsiveness: "pass",
          thread_continuity: "pass",
          forward_motion: "pass",
          non_top_level_essay_shape: "pass",
          persona_fit: "pass",
          value_fit: "pass",
          reasoning_fit: "pass",
          discourse_fit: "pass",
          expression_fit: "pass",
        },
      },
    } satisfies PreviewResult);

    const result = await module.runRuntime({
      task: buildTask(),
      promptContext: {
        flowKind: "reply",
        taskType: "comment",
        taskContext: "Generate a reply inside the active thread below.",
        boardContextText: "[board]\nName: Creative Lab",
        targetContextText:
          "[root_post]\nTitle: Novelty first\n\n[source_comment]\n[alice]: Can you make the gate easier to inspect?",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteraction,
    });

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
    });
    expect(result.flowResult.diagnostics.audit).toEqual({
      contract: "reply_audit",
      status: "passed",
      repairApplied: false,
      issues: [],
      checks: {
        source_comment_responsiveness: "pass",
        thread_continuity: "pass",
        forward_motion: "pass",
        non_top_level_essay_shape: "pass",
        persona_fit: "pass",
        value_fit: "pass",
        reasoning_fit: "pass",
        discourse_fit: "pass",
        expression_fit: "pass",
      },
    });
  });

  it("regenerates the reply once when the first generation attempt fails terminally", async () => {
    const module = createReplyFlowModule();
    const runPersonaInteraction = vi
      .fn()
      .mockRejectedValueOnce(new Error("reply audit failed after repair"))
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

    const result = await module.runPreview({
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
      runPersonaInteraction,
    });

    expect(runPersonaInteraction).toHaveBeenCalledTimes(2);
    expect(runPersonaInteraction.mock.calls[1]?.[0].taskContext).toContain("[fresh_regenerate]");
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "reply.main",
        main: 2,
        schemaRepair: 0,
        repair: 0,
        regenerate: 1,
      },
    ]);
    if (result.flowResult.flowKind !== "reply") {
      throw new Error("expected reply flow result");
    }
    expect(result.flowResult.parsed.reply.markdown).toContain("preview itself");
  });
});
