import { describe, expect, it, vi } from "vitest";
import { createReplyFlowModule } from "@/lib/ai/agent/execution/flows/reply-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";

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
  it("returns first-class reply audit diagnostics in the shared flow envelope", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown:
              "Then make the gate show the rejected angles too, otherwise the operator still cannot tell whether novelty failed or phrasing failed.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
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
        ),
      );

    const result = await flowModule.runRuntime({
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
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
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
        value_fit: "pass",
        reasoning_fit: "pass",
        discourse_fit: "pass",
        expression_fit: "pass",
      },
    });
  });

  it("regenerates the reply once when the first generation attempt fails terminally", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
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
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain(
      "[fresh_regenerate]",
    );
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

  it("runs one schema repair before audit when main output is invalid JSON", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult("Plain prose is not a valid reply JSON object."))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "Schema repair produces the required structured reply.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      stagePurpose: "schema_repair",
      taskType: "reply",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain("[retry_repair]");
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "reply.main",
        main: 1,
        schemaRepair: 1,
        repair: 0,
        regenerate: 0,
      },
    ]);
    if (result.flowResult.flowKind !== "reply") {
      throw new Error("expected reply flow result");
    }
    expect(result.flowResult.parsed.reply.markdown).toContain("Schema repair produces");
  });

  it("regenerates when reply audit still fails after one repair attempt", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      // first main generation
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "This restarts as a broad explanation.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      // first audit -> fail
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            passes: false,
            issues: ["Does not directly answer the source comment."],
            repairGuidance: ["Answer with one concrete workflow change."],
            checks: {
              source_comment_responsiveness: "fail",
              thread_continuity: "fail",
              forward_motion: "fail",
              non_top_level_essay_shape: "fail",
              value_fit: "fail",
              reasoning_fit: "fail",
              discourse_fit: "fail",
              expression_fit: "fail",
            },
          }),
        ),
      )
      // repair output
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "Attempted repair, but still too detached from the source comment.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      // re-audit -> still fail (forces regenerate)
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            passes: false,
            issues: ["Still reads like a top-level essay."],
            repairGuidance: ["Reply to the quoted point directly."],
            checks: {
              source_comment_responsiveness: "fail",
              thread_continuity: "fail",
              forward_motion: "fail",
              non_top_level_essay_shape: "fail",
              value_fit: "fail",
              reasoning_fit: "fail",
              discourse_fit: "fail",
              expression_fit: "fail",
            },
          }),
        ),
      )
      // fresh regenerate generation
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown:
              "The concrete change is splitting malformed-output repair from policy rejection, so operators can diagnose the right failure lane.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      // regenerated audit -> pass
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(6);
    const hasFreshRegenerate = runPersonaInteractionStage.mock.calls.some((call) =>
      call?.[0]?.taskContext?.includes("[fresh_regenerate]"),
    );
    expect(hasFreshRegenerate).toBe(true);
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "reply.main",
        main: 2,
        schemaRepair: 0,
        repair: 1,
        regenerate: 1,
      },
    ]);
    if (result.flowResult.flowKind !== "reply") {
      throw new Error("expected reply flow result");
    }
    expect(result.flowResult.parsed.reply.markdown).toContain("malformed-output repair");
  });

  it("throws typed flow error with failed diagnostics on terminal failure", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport down"))
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
        terminalStage: "reply.main",
      },
    });
  });

  it("classifies invalid reply audit JSON as semantic_audit", async () => {
    const flowModule = createReplyFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "A valid reply body.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult("not json"))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "A second valid reply body.",
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult("not json"));

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
      causeCategory: "semantic_audit",
    });
  });
});
