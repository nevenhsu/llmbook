import { describe, expect, it, vi } from "vitest";
import { createPostFlowModule } from "@/lib/ai/agent/execution/flows/post-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { AiAgentRecentTaskSnapshot } from "@/lib/ai/agent/read-models/overview-read-model";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-prompt-directives";

function buildTask(overrides: Partial<AiAgentRecentTaskSnapshot> = {}): AiAgentRecentTaskSnapshot {
  return {
    id: overrides.id ?? "task-post-1",
    personaId: overrides.personaId ?? "persona-1",
    personaUsername: overrides.personaUsername ?? "ai_orchid",
    personaDisplayName: overrides.personaDisplayName ?? "Orchid",
    taskType: overrides.taskType ?? "post",
    dispatchKind: overrides.dispatchKind ?? "public",
    sourceTable: overrides.sourceTable ?? "posts",
    sourceId: overrides.sourceId ?? "post-source-1",
    dedupeKey: overrides.dedupeKey ?? "ai_orchid:post-source-1:post",
    cooldownUntil: overrides.cooldownUntil ?? null,
    payload: overrides.payload ?? { summary: "Write a new board-native post." },
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

describe("createPostFlowModule", () => {
  it("runs staged post_plan -> post_body flow and hands selected_post_plan into the body stage", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "A weaker pass",
                angle_summary: "Still okay",
                thesis: "A passable idea.",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Different title"],
                board_fit_score: 77,
                title_persona_fit_score: 75,
                title_novelty_score: 76,
                angle_novelty_score: 81,
                body_usefulness_score: 72,
              },
              {
                title: "The workflow bug people keep mislabeling as a prompt bug",
                angle_summary: "Show that many prompt bugs are execution-boundary bugs.",
                thesis:
                  "Teams keep over-editing prompts because they never separated generation, validation, and enforcement into distinct operating steps.",
                body_outline: [
                  "Show why prompt tuning gets blamed too early.",
                  "Contrast malformed-output repair with policy enforcement.",
                  "Give one operator-facing workflow example.",
                ],
                difference_from_recent: ["Workflow anti-patterns"],
                board_fit_score: 89,
                title_persona_fit_score: 82,
                title_novelty_score: 85,
                angle_novelty_score: 90,
                body_usefulness_score: 79,
              },
              {
                title: "Another valid option",
                angle_summary: "A different perspective",
                thesis: "Yet another idea",
                body_outline: ["#option1", "#option2", "#option3"],
                difference_from_recent: ["#different"],
                board_fit_score: 75,
                title_persona_fit_score: 70,
                title_novelty_score: 76,
                angle_novelty_score: 76,
                body_usefulness_score: 73,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "## The missing boundary\n\nRepair is narrow. Enforcement is not.",
            tags: ["#ai", "#workflow"],
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
            contentChecks: {
              angle_fidelity: "pass",
              board_fit: "pass",
              body_usefulness: "pass",
              markdown_structure: "pass",
              title_body_alignment: "pass",
            },
            personaChecks: {
              body_persona_fit: "pass",
              anti_style_compliance: "pass",
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
        flowKind: "post",
        taskType: "post",
        taskContext: "Generate a new post for the board below.",
        boardContextText: "[board]\nName: Creative Lab",
        targetContextText:
          "[recent_board_posts]\n- Workflow anti-patterns people keep blaming on prompts",
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
    expect(runPersonaInteractionStage.mock.calls[0]?.[0]).toMatchObject({
      taskType: "post_plan",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_body",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].targetContextText).toContain(
      "[selected_post_plan]",
    );
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].targetContextText).toContain(
      "Locked title: The workflow bug people keep mislabeling as a prompt bug",
    );
    if (result.flowResult.flowKind !== "post") {
      throw new Error("expected post flow result");
    }
    expect(result.flowResult.parsed.selectedPostPlan.title).toBe(
      "The workflow bug people keep mislabeling as a prompt bug",
    );
    expect(result.flowResult.parsed.renderedPost).toEqual({
      title: "The workflow bug people keep mislabeling as a prompt bug",
      body: "## The missing boundary\n\nRepair is narrow. Enforcement is not.",
      tags: ["#ai", "#workflow"],
      needImage: false,
      imagePrompt: null,
      imageAlt: null,
    });
    expect(result.flowResult.diagnostics.gate).toEqual({
      attempted: true,
      passedCandidateIndexes: [1],
      selectedCandidateIndex: 1,
    });
    expect(result.flowResult.diagnostics.planningCandidates).toEqual([
      expect.objectContaining({
        candidateIndex: 0,
        title: "A weaker pass",
        passedHardGate: false,
      }),
      expect.objectContaining({
        candidateIndex: 1,
        title: "The workflow bug people keep mislabeling as a prompt bug",
        passedHardGate: true,
      }),
      expect.objectContaining({
        candidateIndex: 2,
        title: "Another valid option",
        passedHardGate: false,
      }),
    ]);
    expect(result.flowResult.diagnostics.bodyAudit).toEqual({
      contract: "post_body_audit",
      status: "passed",
      repairApplied: false,
      issues: [],
      contentChecks: {
        angle_fidelity: "pass",
        board_fit: "pass",
        body_usefulness: "pass",
        markdown_structure: "pass",
        title_body_alignment: "pass",
      },
      personaChecks: {
        body_persona_fit: "pass",
        anti_style_compliance: "pass",
        value_fit: "pass",
        reasoning_fit: "pass",
        discourse_fit: "pass",
        expression_fit: "pass",
      },
    });
  });

  it("regenerates post_plan candidates once when the first planning pass fails the hard gate", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Too weak 1",
                angle_summary: "Too weak",
                thesis: "Too weak",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Not enough"],
                board_fit_score: 64,
                title_persona_fit_score: 63,
                title_novelty_score: 66,
                angle_novelty_score: 67,
                body_usefulness_score: 64,
              },
              {
                title: "Too weak 2",
                angle_summary: "Too weak",
                thesis: "Too weak",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Not enough"],
                board_fit_score: 68,
                title_persona_fit_score: 69,
                title_novelty_score: 70,
                angle_novelty_score: 71,
                body_usefulness_score: 68,
              },
              {
                title: "Too weak 3",
                angle_summary: "Too weak",
                thesis: "Too weak",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Not enough"],
                board_fit_score: 66,
                title_persona_fit_score: 65,
                title_novelty_score: 67,
                angle_novelty_score: 69,
                body_usefulness_score: 66,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Fresh passing plan",
                angle_summary: "A genuinely new workflow critique angle.",
                thesis: "Fresh regenerate pass.",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Fresh generation"],
                board_fit_score: 86,
                title_persona_fit_score: 82,
                title_novelty_score: 84,
                angle_novelty_score: 90,
                body_usefulness_score: 81,
              },
              {
                title: "Another pass",
                angle_summary: "Also fine.",
                thesis: "Also fine.",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Different enough"],
                board_fit_score: 80,
                title_persona_fit_score: 78,
                title_novelty_score: 79,
                angle_novelty_score: 82,
                body_usefulness_score: 74,
              },
              {
                title: "Still failing",
                angle_summary: "Weak",
                thesis: "Weak",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["Weak"],
                board_fit_score: 72,
                title_persona_fit_score: 70,
                title_novelty_score: 76,
                angle_novelty_score: 76,
                body_usefulness_score: 71,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "A regenerated body.",
            tags: ["#ai"],
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
            contentChecks: {
              angle_fidelity: "pass",
              board_fit: "pass",
              body_usefulness: "pass",
              markdown_structure: "pass",
              title_body_alignment: "pass",
            },
            personaChecks: {
              body_persona_fit: "pass",
              anti_style_compliance: "pass",
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
        flowKind: "post",
        taskType: "post",
        taskContext: "Generate a new post for the board below.",
        boardContextText: "[board]\nName: Creative Lab",
        targetContextText: "[recent_board_posts]\n- Existing title",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
    });

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(4);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskType).toBe("post_plan");
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain(
      "[planning_audit_repair]",
    );
    expect(result.flowResult.diagnostics.attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "post_plan",
          main: 2,
          repair: 1,
          regenerate: 0,
        }),
        expect.objectContaining({
          stage: "post_body",
          main: 1,
        }),
      ]),
    );
    expect(result.flowResult.diagnostics.gate).toEqual({
      attempted: true,
      passedCandidateIndexes: [0],
      selectedCandidateIndex: 0,
    });
  });

  it("runs one planning audit repair before body stage when post_plan audit fails", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Weak novelty candidate",
                angle_summary: "Not distinct enough",
                thesis: "Too generic",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["minimal"],
                board_fit_score: 82,
                title_persona_fit_score: 81,
                title_novelty_score: 60,
                angle_novelty_score: 61,
                body_usefulness_score: 78,
              },
              {
                title: "Another weak novelty candidate",
                angle_summary: "Still generic",
                thesis: "Also generic",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["minimal"],
                board_fit_score: 80,
                title_persona_fit_score: 80,
                title_novelty_score: 62,
                angle_novelty_score: 63,
                body_usefulness_score: 77,
              },
              {
                title: "Third weak novelty candidate",
                angle_summary: "Again generic",
                thesis: "Again generic",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["minimal"],
                board_fit_score: 79,
                title_persona_fit_score: 79,
                title_novelty_score: 64,
                angle_novelty_score: 65,
                body_usefulness_score: 76,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Repaired passing plan",
                angle_summary: "Distinct execution-boundary perspective.",
                thesis: "Separate malformed-output repair from policy enforcement.",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["fresh framing"],
                board_fit_score: 88,
                title_persona_fit_score: 84,
                title_novelty_score: 86,
                angle_novelty_score: 89,
                body_usefulness_score: 82,
              },
              {
                title: "Backup passing plan",
                angle_summary: "Another fresh angle",
                thesis: "Different but valid",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["another framing"],
                board_fit_score: 82,
                title_persona_fit_score: 80,
                title_novelty_score: 81,
                angle_novelty_score: 83,
                body_usefulness_score: 79,
              },
              {
                title: "Failing candidate",
                angle_summary: "Weak",
                thesis: "Weak",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["weak"],
                board_fit_score: 72,
                title_persona_fit_score: 70,
                title_novelty_score: 76,
                angle_novelty_score: 76,
                body_usefulness_score: 71,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "Post body after repaired planning.",
            tags: ["#ai"],
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
            contentChecks: {
              angle_fidelity: "pass",
              board_fit: "pass",
              body_usefulness: "pass",
              markdown_structure: "pass",
              title_body_alignment: "pass",
            },
            personaChecks: {
              body_persona_fit: "pass",
              anti_style_compliance: "pass",
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
        flowKind: "post",
        taskType: "post",
        taskContext: "Generate a new post for the board below.",
      },
      loadPreferredTextModel: async () => ({
        modelId: "model-1",
        providerKey: "xai",
        modelKey: "grok-4-1-fast-reasoning",
      }),
      runPersonaInteractionStage: runPersonaInteractionStage as any,
      personaEvidence: buildPersonaEvidence(),
    });

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(4);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskType).toBe("post_plan");
    expect(runPersonaInteractionStage.mock.calls[1]?.[0].taskContext).toContain(
      "[planning_audit_repair]",
    );
    if (result.flowResult.flowKind !== "post") {
      throw new Error("expected post flow result");
    }
    expect(result.flowResult.diagnostics.planningAudit).toEqual({
      contract: "post_plan_audit",
      status: "passed_after_repair",
      repairApplied: true,
      issues: expect.any(Array),
      checks: {
        candidate_count: "pass",
        board_fit: "pass",
        novelty_evidence: "pass",
        persona_posting_lens_fit: "pass",
        body_outline_usefulness: "pass",
        no_model_owned_final_selection: "pass",
      },
    });
  });

  it("throws typed flow error with diagnostics when post_body schema remains invalid", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Passing plan A",
                angle_summary: "Distinct angle A",
                thesis: "Thesis A",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["fresh"],
                board_fit_score: 82,
                title_persona_fit_score: 80,
                title_novelty_score: 81,
                angle_novelty_score: 83,
                body_usefulness_score: 79,
              },
              {
                title: "Passing plan B",
                angle_summary: "Distinct angle B",
                thesis: "Thesis B",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["fresh"],
                board_fit_score: 83,
                title_persona_fit_score: 81,
                title_novelty_score: 82,
                angle_novelty_score: 84,
                body_usefulness_score: 80,
              },
              {
                title: "Passing plan C",
                angle_summary: "Distinct angle C",
                thesis: "Thesis C",
                body_outline: ["A", "B", "C"],
                difference_from_recent: ["fresh"],
                board_fit_score: 84,
                title_persona_fit_score: 82,
                title_novelty_score: 83,
                angle_novelty_score: 85,
                body_usefulness_score: 81,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult('{"body":"missing tags"}'))
      .mockResolvedValueOnce(buildPreviewResult('{"body":"still missing tags"}'));

    await expect(
      flowModule.runRuntime({
        task: buildTask(),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new post for the board below.",
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
      flowKind: "post",
      diagnostics: {
        finalStatus: "failed",
        terminalStage: "post_body",
      },
      causeCategory: "schema_validation",
    });
  });
});
