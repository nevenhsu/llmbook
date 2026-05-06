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

function buildPostPlanAuditResult(passes = true) {
  return {
    passes,
    issues: passes ? [] : ["The candidates are too close to recent board posts."],
    repairGuidance: passes ? [] : ["Make each candidate's angle more distinct."],
    checks: {
      candidate_count: "pass",
      persona_fit: "pass",
      novelty_evidence: passes ? "pass" : "fail",
    },
  };
}

function buildPostBodyAuditResult(passes = true) {
  return {
    passes,
    issues: passes ? [] : ["The body does not follow the selected plan."],
    repairGuidance: passes ? [] : ["Rewrite the body to match the locked plan."],
    contentChecks: {
      angle_fidelity: passes ? "pass" : "fail",
      body_usefulness: "pass",
      markdown_structure: "pass",
    },
    personaChecks: {
      body_persona_fit: "pass",
      anti_style_compliance: "pass",
    },
  };
}

function buildPassingPostPlanResponse(title = "Passing semantic plan") {
  return {
    candidates: [
      {
        title,
        thesis: "Separate malformed-output repair from policy enforcement.",
        body_outline: [
          "Show the mistaken blame pattern.",
          "Name the boundary.",
          "Give the operator move.",
        ],
        persona_fit_score: 84,
        novelty_score: 86,
      },
      {
        title: `${title} backup`,
        thesis: "Treat validation and enforcement as different operating steps.",
        body_outline: ["A", "B", "C"],
        persona_fit_score: 80,
        novelty_score: 81,
      },
      {
        title: `${title} third`,
        thesis: "Post-processing boundaries matter more than prompt polish.",
        body_outline: ["A", "B", "C"],
        persona_fit_score: 82,
        novelty_score: 83,
      },
    ],
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
                thesis: "A passable idea.",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 75,
                novelty_score: 76,
              },
              {
                title: "The workflow bug people keep mislabeling as a prompt bug",
                thesis:
                  "Teams keep over-editing prompts because they never separated generation, validation, and enforcement into distinct operating steps.",
                body_outline: [
                  "Show why prompt tuning gets blamed too early.",
                  "Contrast malformed-output repair with policy enforcement.",
                  "Give one operator-facing workflow example.",
                ],
                persona_fit_score: 82,
                novelty_score: 85,
              },
              {
                title: "Another valid option",
                thesis: "Yet another idea",
                body_outline: ["#option1", "#option2", "#option3"],
                persona_fit_score: 70,
                novelty_score: 76,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
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
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostBodyAuditResult())));

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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(4);
    expect(runPersonaInteractionStage.mock.calls[0]?.[0]).toMatchObject({
      taskType: "post_plan",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "audit",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
      taskType: "post_body",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0].targetContextText).toContain(
      "[selected_post_plan]",
    );
    expect(runPersonaInteractionStage.mock.calls[2]?.[0].targetContextText).toContain(
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
      selectedCandidateIndex: 1,
    });
    expect(result.flowResult.diagnostics.planningCandidates).toEqual([
      expect.objectContaining({
        candidateIndex: 0,
        title: "A weaker pass",
        passedHardGate: true,
      }),
      expect.objectContaining({
        candidateIndex: 1,
        title: "The workflow bug people keep mislabeling as a prompt bug",
        passedHardGate: true,
      }),
      expect.objectContaining({
        candidateIndex: 2,
        title: "Another valid option",
        passedHardGate: true,
      }),
    ]);
    expect(result.flowResult.diagnostics.bodyAudit).toEqual({
      contract: "post_body_audit",
      status: "passed",
      repairApplied: false,
      issues: [],
      contentChecks: {
        angle_fidelity: "pass",
        body_usefulness: "pass",
        markdown_structure: "pass",
      },
      personaChecks: {
        body_persona_fit: "pass",
        anti_style_compliance: "pass",
      },
    });
  });

  it("selects the best candidate and runs post_body when candidates pass validation", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Low score candidate",
                thesis: "Still valid content.",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 63,
                novelty_score: 66,
              },
              {
                title: "Better candidate",
                thesis: "Stronger thesis.",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 80,
                novelty_score: 82,
              },
              {
                title: "Third candidate",
                thesis: "Decent idea.",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 70,
                novelty_score: 72,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "Post body from the best candidate.",
            tags: ["#ai"],
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostBodyAuditResult())));

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
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "audit",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
      taskType: "post_body",
      stagePurpose: "main",
    });
    expect(runPersonaInteractionStage.mock.calls[3]?.[0]).toMatchObject({
      taskType: "post_body",
      stagePurpose: "audit",
    });
    expect(result.flowResult.diagnostics.gate).toEqual({
      attempted: true,
      selectedCandidateIndex: 1,
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
                thesis: "Too generic",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 81,
                novelty_score: 60,
              },
              {
                title: "Another weak novelty candidate",
                thesis: "Also generic",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 80,
                novelty_score: 62,
              },
              {
                title: "Third weak novelty candidate",
                thesis: "Again generic",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 79,
                novelty_score: 64,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult(false))))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            candidates: [
              {
                title: "Repaired passing plan",
                thesis: "Separate malformed-output repair from policy enforcement.",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 84,
                novelty_score: 86,
              },
              {
                title: "Backup passing plan",
                thesis: "Different but valid",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 80,
                novelty_score: 81,
              },
              {
                title: "Failing candidate",
                thesis: "Weak",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 70,
                novelty_score: 76,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
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
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostBodyAuditResult())));

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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(6);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "audit",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "quality_repair",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0].taskContext).toContain(
      "[planning_repair]",
    );
    expect(runPersonaInteractionStage.mock.calls[3]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "audit",
    });
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
        persona_fit: "pass",
        novelty_evidence: "pass",
      },
    });
  });

  it("throws typed semantic audit error when post_plan audit still fails after repair", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPassingPostPlanResponse())))
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult(false))))
      .mockResolvedValueOnce(
        buildPreviewResult(JSON.stringify(buildPassingPostPlanResponse("Repaired plan"))),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult(false))));

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
        terminalStage: "post_plan",
        planningAudit: {
          contract: "post_plan_audit",
          status: "failed",
          repairApplied: true,
        },
      },
      causeCategory: "semantic_audit",
    });

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(4);
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "audit",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0].taskContext).toContain(
      "[planning_repair]",
    );
  });

  it("classifies invalid post_body audit JSON as semantic_audit", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPassingPostPlanResponse())))
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "A valid post body.",
            tags: ["#ai"],
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
      causeCategory: "semantic_audit",
    });
  });

  it("classifies invalid post_body quality repair output as quality_repair", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPassingPostPlanResponse())))
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
      .mockResolvedValueOnce(
        buildPreviewResult(
          JSON.stringify({
            body: "A valid but semantically weak body.",
            tags: ["#ai"],
            need_image: false,
            image_prompt: null,
            image_alt: null,
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostBodyAuditResult(false))))
      .mockResolvedValueOnce(buildPreviewResult("not json"));

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
      causeCategory: "quality_repair",
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
                thesis: "Thesis A",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 80,
                novelty_score: 81,
              },
              {
                title: "Passing plan B",
                thesis: "Thesis B",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 81,
                novelty_score: 82,
              },
              {
                title: "Passing plan C",
                thesis: "Thesis C",
                body_outline: ["A", "B", "C"],
                persona_fit_score: 82,
                novelty_score: 83,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPostPlanAuditResult())))
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
