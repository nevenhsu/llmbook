import { describe, expect, it, vi } from "vitest";
import { createPostFlowModule } from "@/lib/ai/agent/execution/flows/post-flow-module";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type { TaskSnapshot } from "@/lib/ai/agent/read-models/task-snapshot";
import type { PromptPersonaEvidence } from "@/lib/ai/prompt-runtime/persona-audit-shared";

function buildTask(overrides: Partial<TaskSnapshot> = {}): TaskSnapshot {
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

function buildPreviewResult(rawResponse: string, object?: unknown): PreviewResult {
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
    object,
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

function buildValidPostFrame(overrides: Record<string, unknown> = {}) {
  return {
    main_idea:
      "Teams over-edit prompts because they never separated generation, validation, and enforcement into distinct operating steps.",
    angle: "The workflow boundary is the real bottleneck, not the prompt wording.",
    beats: [
      "Hook: show why prompt tuning gets blamed too early",
      "Example: contrast malformed-output repair with policy enforcement",
      "Interpretation: explain what the boundary shift reveals about tool design",
      "Twist: the best prompt engineers stop tuning and start enforcing",
      "Closing: reframe the operator's job as boundary maintenance",
    ],
    required_details: [
      "A concrete example of a malformed JSON output that passed validation",
      "The specific moment when enforcement, not repair, caught the issue",
      "A social observation about why teams prefer prompt tuning to workflow changes",
      "A comparison to a non-AI engineering discipline",
    ],
    ending_direction:
      "Land on the irony that the fix was never about better prompts — it was about harder gates.",
    tone: ["sharp", "practical", "slightly contrarian"],
    avoid: [
      "vague commentary without example",
      "generic summary without specific observation",
      "tutorial tone",
      "assistant-like explanation",
    ],
    ...overrides,
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
  it("runs staged post_plan -> post_frame -> post_body flow", async () => {
    const flowModule = createPostFlowModule();
    const postFrame = buildValidPostFrame();
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
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
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
    const planningCall = runPersonaInteractionStage.mock.calls[0]?.[0];
    expect(planningCall?.taskType).toBe("post_plan");
    expect(planningCall?.taskContext).toContain("Generate a new post for the board below.");
    expect(planningCall?.taskContext).toContain("planning stage");
    expect(planningCall?.taskContext).toContain("do not write the final post body");

    const frameCall = runPersonaInteractionStage.mock.calls[1]?.[0];
    expect(frameCall?.taskType).toBe("post_frame");
    expect(frameCall?.taskContext).toContain("PostFrame object");
    expect(frameCall?.taskContext).toContain("locked title and thesis");
    expect(frameCall?.taskContext).toContain("Do not mention prompt instructions");

    const bodyCall = runPersonaInteractionStage.mock.calls[2]?.[0];
    expect(bodyCall?.taskType).toBe("post_body");
    expect(bodyCall?.taskContext).toContain("final post body");
    expect(bodyCall?.taskContext).toContain("title is locked");
    expect(bodyCall?.taskContext).toContain("post_frame");
    expect(bodyCall?.targetContextText).toContain(
      "[selected_post_plan]",
    );
    expect(bodyCall?.targetContextText).toContain(
      "Locked title: The workflow bug people keep mislabeling as a prompt bug",
    );
    if (result.flowResult.flowKind !== "post") {
      throw new Error("expected post flow result");
    }
    expect(result.flowResult.parsed.selectedPostPlan.title).toBe(
      "The workflow bug people keep mislabeling as a prompt bug",
    );
    expect(result.flowResult.parsed.postFrame).toBeDefined();
    expect(result.flowResult.parsed.postFrame!.main_idea).toBe(postFrame.main_idea);
    expect(result.flowResult.parsed.renderedPost).toEqual({
      title: "The workflow bug people keep mislabeling as a prompt bug",
      body: "## The missing boundary\n\nRepair is narrow. Enforcement is not.",
      tags: ["#ai", "#workflow"],
      needImage: false,
      imagePrompt: null,
      imageAlt: null,
      metadata: { probability: 0 },
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
  });

  it("selects the best candidate and runs full 3-stage post flow", async () => {
    const flowModule = createPostFlowModule();
    const postFrame = buildValidPostFrame();
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
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
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

    expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
    expect(runPersonaInteractionStage.mock.calls[0]?.[0]).toMatchObject({
      taskType: "post_plan",
      stagePurpose: "main",
    });
    expect(runPersonaInteractionStage.mock.calls[1]?.[0]).toMatchObject({
      taskType: "post_frame",
      stagePurpose: "main",
    });
    expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
      taskType: "post_body",
      stagePurpose: "main",
    });
    expect(result.flowResult.diagnostics.gate).toEqual({
      attempted: true,
      selectedCandidateIndex: 1,
    });
  });

  it("throws typed flow error with diagnostics when post_body schema remains invalid", async () => {
    const flowModule = createPostFlowModule();
    const postFrame = buildValidPostFrame();
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
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
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

  it("classifies post_frame schema-gate failures as schema_validation", async () => {
    const flowModule = createPostFlowModule();
    const runPersonaInteractionStage = vi
      .fn()
      .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(buildPassingPostPlanResponse())))
      .mockRejectedValueOnce(new Error("Schema gate failed for PostFrameSchema"));

    await expect(
      flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "story" } }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new story for the board below.",
          boardContextText: "[board]\nName: Story Lab",
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
        terminalStage: "post_frame",
      },
      causeCategory: "schema_validation",
    });
  });

  describe("post_frame integration", () => {
    it("runs post_plan -> post_frame -> post_body for discussion mode", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame();
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "Test Plan",
                  thesis: "A test thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 82,
                  novelty_score: 85,
                },
                {
                  title: "Backup Plan",
                  thesis: "Backup thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Third Plan",
                  thesis: "Third thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## Post body content",
              tags: ["#ai", "#workflow"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      const result = await flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "discussion" } }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new post for the board below.",
          boardContextText: "[board]\nName: Creative Lab",
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
        taskType: "post_frame",
      });
      expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
        taskType: "post_body",
      });
      if (result.flowResult.flowKind !== "post") {
        throw new Error("expected post flow result");
      }
      expect(result.flowResult.parsed.postFrame).toBeDefined();
      expect(result.flowResult.parsed.postFrame!.beats).toHaveLength(5);
      expect(result.flowResult.parsed.postFrame!.required_details).toHaveLength(4);
    });

    it("runs post_plan -> post_frame -> post_body for story mode", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame({
        main_idea:
          "An old-blood Deep One must decide whether to share the last warm pool with surface-born hybrids.",
        angle:
          "Told through the ritual of pool-allocation, where every gesture carries centuries of hierarchy.",
        beats: [
          "Setup: the cooling announcement",
          "Encounter: a young hybrid petitions",
          "Complication: the old-blood's own child supports the petition",
          "Recognition: the hierarchy was never about warmth",
          "Ending: the old-blood opens the gate but cannot enter",
        ],
        required_details: [
          "The phosphorescent lichen that marks the pool's edge",
          "The sound of gill-flutters in silence",
          "A dialogue fragment about surface-born cold",
          "The gesture of touching one's own gill-slits before speaking to an elder",
        ],
        ending_direction:
          "Image: the old-blood watches from the cold trench as hybrids share the pool.",
        tone: ["eerie", "restrained", "melancholy", "ceremonial"],
        avoid: [
          "direct moralizing about equality",
          "generic horror adjectives",
          "assistant-like commentary",
          "abstract claims without sensory dramatization",
        ],
      });
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "The Last Warm Pool",
                  thesis: "A story of hierarchy and warmth.",
                  body_outline: ["Introduce the old-blood", "The petition arrives", "Resolution"],
                  persona_fit_score: 85,
                  novelty_score: 88,
                },
                {
                  title: "Backup Story",
                  thesis: "Another story idea.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Third Story",
                  thesis: "Third story idea.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## The Last Warm Pool\n\nThe old-blood felt the temperature drop first...",
              tags: ["#cthulhu", "#story"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      const result = await flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "story" } }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new story for the board below.",
          boardContextText: "[board]\nName: Story Lab",
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
        taskType: "post_frame",
      });
      expect(runPersonaInteractionStage.mock.calls[2]?.[0]).toMatchObject({
        taskType: "post_body",
      });
      if (result.flowResult.flowKind !== "post") {
        throw new Error("expected post flow result");
      }
      expect(result.flowResult.parsed.postFrame).toBeDefined();
      expect(result.flowResult.parsed.postFrame!.beats).toHaveLength(5);
    });

    it("story-mode post_frame call passes contentMode through the stage boundary", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame();
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "Story Plan",
                  thesis: "A story thesis.",
                  body_outline: ["Intro", "Middle", "End"],
                  persona_fit_score: 85,
                  novelty_score: 88,
                },
                {
                  title: "Backup",
                  thesis: "Backup thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Third",
                  thesis: "Third thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## Story body",
              tags: ["#story"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      await flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "story" } }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new story for the board below.",
          boardContextText: "[board]\nName: Story Lab",
        },
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteractionStage: runPersonaInteractionStage as any,
        personaEvidence: buildPersonaEvidence(),
      });

      // The critical assertion: post_frame call receives contentMode: "story"
      expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
      const frameCall = runPersonaInteractionStage.mock.calls[1]?.[0];
      expect(frameCall.taskType).toBe("post_frame");
      expect(frameCall.contentMode).toBe("story");
    });

    it("discussion-mode post_frame defaults contentMode correctly", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame();
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "Discussion Plan",
                  thesis: "A discussion thesis.",
                  body_outline: ["Point 1", "Point 2", "Point 3"],
                  persona_fit_score: 85,
                  novelty_score: 88,
                },
                {
                  title: "Backup",
                  thesis: "Backup thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Third",
                  thesis: "Third thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## Discussion body",
              tags: ["#ai"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      // No contentMode in payload — should default to "discussion"
      await flowModule.runRuntime({
        task: buildTask({ payload: {} }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new post for the board below.",
          boardContextText: "[board]\nName: Creative Lab",
        },
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteractionStage: runPersonaInteractionStage as any,
        personaEvidence: buildPersonaEvidence(),
      });

      const frameCall = runPersonaInteractionStage.mock.calls[1]?.[0];
      expect(frameCall.taskType).toBe("post_frame");
      expect(frameCall.contentMode).toBe("discussion");
    });

    it("post_body receives combined selected_post_plan + post_frame context", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame();
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "The Missing Boundary",
                  thesis: "Separate generation from enforcement.",
                  body_outline: [
                    "Show the mistaken blame",
                    "Name the boundary",
                    "Give the operator move",
                  ],
                  persona_fit_score: 84,
                  novelty_score: 86,
                },
                {
                  title: "Backup A",
                  thesis: "Backup thesis.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Backup B",
                  thesis: "Another backup.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 79,
                  novelty_score: 78,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(JSON.stringify(postFrame), postFrame))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## Post body content",
              tags: ["#ai", "#workflow"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      await flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "discussion" } }),
        promptContext: {
          flowKind: "post",
          taskType: "post",
          taskContext: "Generate a new post for the board below.",
          boardContextText: "[board]\nName: Creative Lab",
        },
        loadPreferredTextModel: async () => ({
          modelId: "model-1",
          providerKey: "xai",
          modelKey: "grok-4-1-fast-reasoning",
        }),
        runPersonaInteractionStage: runPersonaInteractionStage as any,
        personaEvidence: buildPersonaEvidence(),
      });

      const bodyCallTarget = runPersonaInteractionStage.mock.calls[2]?.[0]
        .targetContextText as string;
      expect(bodyCallTarget).toContain("[selected_post_plan]");
      expect(bodyCallTarget).toContain("Locked title: The Missing Boundary");
      expect(bodyCallTarget).toContain("[post_frame]");
      expect(bodyCallTarget).toContain("Content mode:");
      expect(bodyCallTarget).toContain("Main idea:");
      expect(bodyCallTarget).toContain("Angle:");
      expect(bodyCallTarget).toContain("Beats:");
      expect(bodyCallTarget).toContain("Required details:");
      expect(bodyCallTarget).toContain("Ending direction:");
      expect(bodyCallTarget).toContain("Tone:");
      expect(bodyCallTarget).toContain("Avoid:");
    });

    it("falls back to parsing PostFrame from markdown when object is missing", async () => {
      const flowModule = createPostFlowModule();
      const postFrame = buildValidPostFrame();
      const frameJson = JSON.stringify(postFrame);
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "Fallback Test",
                  thesis: "Testing markdown fallback.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 82,
                  novelty_score: 85,
                },
                {
                  title: "Backup",
                  thesis: "Backup.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Third",
                  thesis: "Third.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult(`\`\`\`json\n${frameJson}\n\`\`\``, undefined))
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              body: "## Post body from fallback",
              tags: ["#ai"],
              need_image: false,
              image_prompt: null,
              image_alt: null,
            }),
          ),
        );

      const result = await flowModule.runRuntime({
        task: buildTask({ payload: { contentMode: "discussion" } }),
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

      expect(runPersonaInteractionStage).toHaveBeenCalledTimes(3);
      if (result.flowResult.flowKind !== "post") {
        throw new Error("expected post flow result");
      }
      expect(result.flowResult.parsed.postFrame).toBeDefined();
      expect(result.flowResult.parsed.postFrame!.main_idea).toBe(postFrame.main_idea);
    });

    it("fails when post_frame output cannot be parsed and classifies as schema_validation", async () => {
      const flowModule = createPostFlowModule();
      const runPersonaInteractionStage = vi
        .fn()
        .mockResolvedValueOnce(
          buildPreviewResult(
            JSON.stringify({
              candidates: [
                {
                  title: "Plan A",
                  thesis: "Thesis A.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 82,
                  novelty_score: 85,
                },
                {
                  title: "Plan B",
                  thesis: "Thesis B.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 80,
                  novelty_score: 81,
                },
                {
                  title: "Plan C",
                  thesis: "Thesis C.",
                  body_outline: ["A", "B", "C"],
                  persona_fit_score: 78,
                  novelty_score: 79,
                },
              ],
            }),
          ),
        )
        .mockResolvedValueOnce(buildPreviewResult("not valid json at all"));

      await expect(
        flowModule.runRuntime({
          task: buildTask({ payload: { contentMode: "discussion" } }),
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
          terminalStage: "post_frame",
        },
        causeCategory: "schema_validation",
      });
    });
  });
});
