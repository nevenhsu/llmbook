import { describe, expect, it, vi } from "vitest";
import { createCommentFlowModule } from "@/lib/ai/agent/execution/flows/comment-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";

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
  it("returns first-class comment audit diagnostics in the shared flow envelope", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown:
              "I would push this one step further: the board needs a novelty rubric, not just title filtering.",
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
        ),
      );

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
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
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
      status: "passed",
      repairApplied: false,
      issues: [],
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
    });
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "comment.main",
        main: 1,
        schemaRepair: 0,
        repair: 0,
        regenerate: 0,
      },
    ]);
  });

  it("regenerates the comment once when the first generation attempt fails terminally", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
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
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain(
      "[fresh_regenerate]",
    );
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

  it("runs one schema repair before audit when main output is invalid JSON", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult("Plain prose is not a valid comment JSON object."))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "Schema repair produces the required structured comment.",
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      stagePurpose: "schema_repair",
      taskType: "comment",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain("[retry_repair]");
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "comment.main",
        main: 1,
        schemaRepair: 1,
        repair: 0,
        regenerate: 0,
      },
    ]);
    if (result.flowResult.flowKind !== "comment") {
      throw new Error("expected comment flow result");
    }
    expect(result.flowResult.parsed.comment.markdown).toContain("Schema repair produces");
  });

  it("regenerates when audit still fails after one repair attempt", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      // first main generation
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "This is still broad and generic.",
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
            issues: ["Too generic and repeats recent thread framing."],
            repairGuidance: ["Add one concrete boundary-level distinction."],
            checks: {
              post_relevance: "pass",
              net_new_value: "fail",
              non_repetition_against_recent_comments: "fail",
              standalone_top_level_shape: "fail",
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
            markdown: "Attempted repair but still not thread-native enough.",
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
            issues: ["Still repeats nearby top-level wording."],
            repairGuidance: ["Force a fresh framing."],
            checks: {
              post_relevance: "pass",
              net_new_value: "fail",
              non_repetition_against_recent_comments: "fail",
              standalone_top_level_shape: "fail",
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
              "The core fix is to separate schema-repair from policy-gate failures in operator logs.",
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(6);
    const hasFreshRegenerate = runPersonaInteractionStage.mock.calls.some((call) =>
      call?.[0]?.taskContext?.includes("[fresh_regenerate]"),
    );
    expect(hasFreshRegenerate).toBe(true);
    expect(result.flowResult.diagnostics.attempts).toEqual([
      {
        stage: "comment.main",
        main: 2,
        schemaRepair: 0,
        repair: 1,
        regenerate: 1,
      },
    ]);
    if (result.flowResult.flowKind !== "comment") {
      throw new Error("expected comment flow result");
    }
    expect(result.flowResult.parsed.comment.markdown).toContain("schema-repair");
  });

  it("throws typed flow error with failed diagnostics on terminal failure", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockRejectedValueOnce(new Error("transport down"))
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
        terminalStage: "comment.main",
      },
    });
  });

  it("classifies invalid comment audit JSON as semantic_audit", async () => {
    const flowModule = createCommentFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            markdown: "A valid comment body.",
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
            markdown: "A second valid comment body.",
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
      causeCategory: "semantic_audit",
    });
  });
});
