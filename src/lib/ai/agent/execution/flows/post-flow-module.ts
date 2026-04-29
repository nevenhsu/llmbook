import { parsePostBodyActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";
import {
  computePostPlanOverallScore,
  evaluatePostPlanGate,
  parsePostPlanActionOutput,
  validatePostPlanOutput,
  type PostPlanCandidate,
} from "@/lib/ai/prompt-runtime/post-plan-contract";
import {
  buildPostPlanAuditPrompt,
  buildPostPlanRepairPrompt,
  parsePostPlanAuditResult,
  type PostPlanAuditResult,
} from "@/lib/ai/prompt-runtime/post-plan-audit";
import type {
  FlowDiagnostics,
  SelectedPostPlan,
  TextFlowExecutionErrorCauseCategory,
  TextFlowModule,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import {
  TextFlowExecutionError,
  buildModuleMetadata,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

function buildSelectedPostPlan(candidate: PostPlanCandidate): SelectedPostPlan {
  return {
    title: candidate.title,
    angleSummary: candidate.angleSummary,
    thesis: candidate.thesis,
    bodyOutline: candidate.bodyOutline,
    differenceFromRecent: candidate.differenceFromRecent,
  };
}

function buildSelectedPostPlanBlock(plan: SelectedPostPlan): string {
  return [
    "[selected_post_plan]",
    `Locked title: ${plan.title}`,
    `Angle summary: ${plan.angleSummary}`,
    `Thesis: ${plan.thesis}`,
    "Body outline:",
    ...plan.bodyOutline.map((item) => `- ${item}`),
    "Difference from recent:",
    ...plan.differenceFromRecent.map((item) => `- ${item}`),
    "Do not change the title or topic.",
  ].join("\n");
}

function buildPlanningTaskContext(baseTaskContext: string): string {
  return [
    baseTaskContext,
    "This is the planning stage only.",
    "Return 3 candidates, score conservatively, and do not write the final post body.",
  ].join("\n\n");
}

function buildFreshPlanningTaskContext(baseTaskContext: string): string {
  return [
    buildPlanningTaskContext(baseTaskContext),
    "Generate a fresh set of 3 candidates.",
    "Do not reuse titles or angles from the previous planning attempt.",
  ].join("\n\n");
}

function buildPlanningSchemaRepairTaskContext(
  baseTaskContext: string,
  previousOutput: string,
): string {
  return [
    buildPlanningTaskContext(baseTaskContext),
    "[retry_repair]",
    "Your previous post_plan response did not satisfy the required JSON contract.",
    "Rewrite it as exactly one valid JSON object with exactly 3 candidates.",
    "Do not add overall_score or any extra keys.",
    "",
    "[previous_invalid_response]",
    previousOutput,
  ].join("\n");
}

function buildPostBodyTaskContext(): string {
  return [
    "Write the final post body for the selected plan below.",
    "The title is locked by the app and must not be changed.",
    "Expand the chosen angle faithfully.",
    "Write markdown that carries a clear claim, structure, and concrete usefulness.",
  ].join("\n");
}

function buildPostBodySchemaRepairTaskContext(previousOutput: string): string {
  return [
    buildPostBodyTaskContext(),
    "[retry_repair]",
    "Your previous post_body response did not satisfy the required JSON contract.",
    "Rewrite it as exactly one valid JSON object.",
    "Required keys: body, tags, need_image, image_prompt, image_alt.",
    "Do not output title.",
    "",
    "[previous_invalid_response]",
    previousOutput,
  ].join("\n");
}

function renderFinalPostForAudit(input: { title: string; body: string; tags: string[] }): string {
  return [`# ${input.title}`, input.tags.join(" ").trim() || null, input.body.trim()]
    .filter((part): part is string => Boolean(part))
    .join("\n\n")
    .trim();
}

function classifyPostFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("quality repair")) {
    return "quality_repair";
  }
  if (error.message.includes("audit failed") || error.message.includes("audit")) {
    return "semantic_audit";
  }
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
  }
  if (error.message.includes("hard gate")) {
    return "deterministic_gate";
  }
  return "transport";
}

async function runPostFlow(
  input: TextFlowModuleRunInput,
  mode: "preview" | "runtime",
): Promise<TextFlowModuleRunResult> {
  const promptContext = mergeFlowTaskContext({
    promptContext: input.promptContext,
    extraInstructions: input.extraInstructions,
  });
  const modelSelection = await input.loadPreferredTextModel();
  const planningAttempt = {
    stage: "post_plan",
    main: 0,
    schemaRepair: 0,
    repair: 0,
    regenerate: 0,
  };
  const bodyAttempt = {
    stage: "post_body",
    main: 0,
    schemaRepair: 0,
    repair: 0,
    regenerate: 0,
  };
  const stageResults: FlowDiagnostics["stageResults"] = [];

  const invokeStage = async (stageInput: {
    taskType: "post_plan" | "post_body";
    stagePurpose: "main" | "schema_repair" | "audit" | "quality_repair";
    taskContext: string;
    targetContextText?: string;
  }) =>
    input.runPersonaInteractionStage({
      personaId: input.task.personaId,
      modelId: modelSelection.modelId,
      taskType: stageInput.taskType,
      stagePurpose: stageInput.stagePurpose,
      taskContext: stageInput.taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: stageInput.targetContextText,
    });

  const runPlanningAttempt = async (
    taskContext: string,
    countsAsRegenerate: boolean,
  ): Promise<{
    preview: Awaited<ReturnType<typeof invokeStage>>;
    parsed: NonNullable<ReturnType<typeof parsePostPlanActionOutput>["output"]>;
    validationIssues: string[];
    gate: ReturnType<typeof evaluatePostPlanGate>;
    audit: PostPlanAuditResult;
  }> => {
    planningAttempt.main += 1;
    if (countsAsRegenerate) {
      planningAttempt.regenerate += 1;
      planningAttempt.schemaRepair = 0;
    }
    let preview = await invokeStage({
      taskType: "post_plan",
      stagePurpose: "main",
      taskContext,
      targetContextText: promptContext.targetContextText,
    });
    let parsed = parsePostPlanActionOutput(preview.rawResponse ?? preview.markdown);
    let validationIssues = parsed.output
      ? validatePostPlanOutput(parsed.output)
      : [parsed.error ?? "invalid post_plan output"];

    if ((parsed.error || validationIssues.length > 0) && planningAttempt.schemaRepair < 1) {
      planningAttempt.schemaRepair += 1;
      preview = await invokeStage({
        taskType: "post_plan",
        stagePurpose: "schema_repair",
        taskContext: buildPlanningSchemaRepairTaskContext(
          taskContext,
          preview.rawResponse ?? preview.markdown,
        ),
        targetContextText: promptContext.targetContextText,
      });
      parsed = parsePostPlanActionOutput(preview.rawResponse ?? preview.markdown);
      validationIssues = parsed.output
        ? validatePostPlanOutput(parsed.output)
        : [parsed.error ?? "invalid post_plan output"];
    }

    if (!parsed.output || validationIssues.length > 0) {
      throw new Error(validationIssues[0] ?? parsed.error ?? "post_plan stage failed");
    }

    const auditPreview = await invokeStage({
      taskType: "post_plan",
      stagePurpose: "audit",
      taskContext: buildPostPlanAuditPrompt({
        candidates: parsed.output.candidates,
        boardContextText: promptContext.boardContextText,
        targetContextText: promptContext.targetContextText,
        personaEvidence: input.personaEvidence,
      }),
    });
    const audit = parsePostPlanAuditResult(auditPreview.rawResponse ?? auditPreview.markdown);

    return {
      preview,
      parsed: parsed.output,
      validationIssues,
      audit,
      gate: evaluatePostPlanGate(parsed.output),
    };
  };

  let finalPlanningOutput: { candidates: PostPlanCandidate[] } | null = null;
  let planningAuditResult: FlowDiagnostics["planningAudit"] | undefined;
  let selectedCandidate: PostPlanCandidate | null = null;
  let gateResult = {
    attempted: true,
    passedCandidateIndexes: [] as number[],
    selectedCandidateIndex: null as number | null,
  };

  try {
    const firstPlanning = await runPlanningAttempt(
      buildPlanningTaskContext(promptContext.taskContext),
      false,
    );
    let activePlanning = firstPlanning;
    const firstAudit = firstPlanning.audit;
    if (!firstAudit.passes) {
      planningAttempt.repair += 1;
      const repairedPlanning = await runPlanningAttempt(
        buildPostPlanRepairPrompt({
          baseTaskContext: buildPlanningTaskContext(promptContext.taskContext),
          issues: firstAudit.issues,
          repairGuidance: firstAudit.repairGuidance,
          previousOutput: firstPlanning.preview.rawResponse ?? firstPlanning.preview.markdown,
        }),
        false,
      );
      const repairedAudit = repairedPlanning.audit;
      if (!repairedAudit.passes) {
        planningAuditResult = {
          contract: "post_plan_audit",
          status: "failed",
          repairApplied: true,
          issues: repairedAudit.issues.length > 0 ? repairedAudit.issues : firstAudit.issues,
          checks: repairedAudit.checks,
        };
        throw new Error("post_plan audit failed after repair");
      }
      planningAuditResult = {
        contract: "post_plan_audit",
        status: "passed_after_repair",
        repairApplied: true,
        issues: firstAudit.issues,
        checks: repairedAudit.checks,
      };
      activePlanning = repairedPlanning;
    } else {
      planningAuditResult = {
        contract: "post_plan_audit",
        status: "passed",
        repairApplied: false,
        issues: firstAudit.issues,
        checks: firstAudit.checks,
      };
    }

    finalPlanningOutput = activePlanning.parsed;
    gateResult = {
      attempted: true,
      passedCandidateIndexes: activePlanning.gate.passedCandidateIndexes,
      selectedCandidateIndex: activePlanning.gate.selectedCandidateIndex,
    };
    selectedCandidate =
      activePlanning.gate.selectedCandidateIndex === null
        ? null
        : (activePlanning.parsed.candidates[activePlanning.gate.selectedCandidateIndex] ?? null);

    if (!selectedCandidate) {
      const freshPlanning = await runPlanningAttempt(
        buildFreshPlanningTaskContext(promptContext.taskContext),
        true,
      );
      if (!freshPlanning.audit.passes) {
        planningAuditResult = {
          contract: "post_plan_audit",
          status: "failed",
          repairApplied: false,
          issues: freshPlanning.audit.issues,
          checks: freshPlanning.audit.checks,
        };
        throw new Error("post_plan audit failed after fresh regeneration");
      }
      planningAuditResult = {
        contract: "post_plan_audit",
        status:
          planningAuditResult?.status === "passed_after_repair" ? "passed_after_repair" : "passed",
        repairApplied: planningAuditResult?.repairApplied ?? false,
        issues: planningAuditResult?.issues ?? freshPlanning.audit.issues,
        checks: freshPlanning.audit.checks,
      };
      finalPlanningOutput = freshPlanning.parsed;
      gateResult = {
        attempted: true,
        passedCandidateIndexes: freshPlanning.gate.passedCandidateIndexes,
        selectedCandidateIndex: freshPlanning.gate.selectedCandidateIndex,
      };
      selectedCandidate =
        freshPlanning.gate.selectedCandidateIndex === null
          ? null
          : (freshPlanning.parsed.candidates[freshPlanning.gate.selectedCandidateIndex] ?? null);
    }

    if (!selectedCandidate) {
      throw new Error("post_plan stage failed: no candidates passed the hard gate");
    }
    stageResults.push({ stage: "post_plan", status: "passed" });
  } catch (error) {
    stageResults.push({ stage: "post_plan", status: "failed" });
    const failure = error instanceof Error ? error : new Error(String(error));
    throw new TextFlowExecutionError({
      message: failure.message,
      flowKind: "post",
      diagnostics: {
        finalStatus: "failed",
        terminalStage: "post_plan",
        attempts: [planningAttempt, bodyAttempt],
        stageResults,
        gate: gateResult,
        planningAudit: planningAuditResult,
      },
      causeCategory: classifyPostFailure(failure),
      cause: failure,
    });
  }

  const selectedPostPlan = buildSelectedPostPlan(selectedCandidate);
  let bodyPreview;
  let parsedBody;
  let bodyAuditResult:
    | {
        status: "passed" | "passed_after_repair";
        repairApplied: boolean;
        issues: string[];
        contentChecks: {
          angle_fidelity: "pass" | "fail";
          board_fit: "pass" | "fail";
          body_usefulness: "pass" | "fail";
          markdown_structure: "pass" | "fail";
          title_body_alignment: "pass" | "fail";
        };
        personaChecks: {
          body_persona_fit: "pass" | "fail";
          anti_style_compliance: "pass" | "fail";
          value_fit: "pass" | "fail";
          reasoning_fit: "pass" | "fail";
          discourse_fit: "pass" | "fail";
          expression_fit: "pass" | "fail";
        };
      }
    | undefined;

  try {
    bodyAttempt.main += 1;
    bodyPreview = await invokeStage({
      taskType: "post_body",
      stagePurpose: "main",
      taskContext: buildPostBodyTaskContext(),
      targetContextText: buildSelectedPostPlanBlock(selectedPostPlan),
    });
    parsedBody = parsePostBodyActionOutput(bodyPreview.rawResponse ?? bodyPreview.markdown);

    if (parsedBody.error && bodyAttempt.schemaRepair < 1) {
      bodyAttempt.schemaRepair += 1;
      bodyPreview = await invokeStage({
        taskType: "post_body",
        stagePurpose: "schema_repair",
        taskContext: buildPostBodySchemaRepairTaskContext(
          bodyPreview.rawResponse ?? bodyPreview.markdown,
        ),
        targetContextText: buildSelectedPostPlanBlock(selectedPostPlan),
      });
      parsedBody = parsePostBodyActionOutput(bodyPreview.rawResponse ?? bodyPreview.markdown);
    }

    if (parsedBody.error) {
      throw new Error(parsedBody.error);
    }

    const selectedPostPlanText = buildSelectedPostPlanBlock(selectedPostPlan);
    const initialAuditPreview = await invokeStage({
      taskType: "post_body",
      stagePurpose: "audit",
      taskContext: buildPostBodyAuditPrompt({
        boardContextText: promptContext.boardContextText,
        selectedPostPlanText,
        renderedFinalPost: renderFinalPostForAudit({
          title: selectedPostPlan.title,
          body: parsedBody.body,
          tags: parsedBody.tags,
        }),
        personaEvidence: input.personaEvidence,
      }),
    });
    const initialAudit = parsePostBodyAuditResult(
      initialAuditPreview.rawResponse ?? initialAuditPreview.markdown,
    );

    if (!initialAudit.passes) {
      bodyAttempt.repair += 1;
      const repairPreview = await invokeStage({
        taskType: "post_body",
        stagePurpose: "quality_repair",
        taskContext: buildPostBodyRepairPrompt({
          selectedPostPlanText,
          personaEvidence: input.personaEvidence,
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          previousOutput: bodyPreview.rawResponse ?? bodyPreview.markdown,
        }),
        targetContextText: selectedPostPlanText,
      });
      const repairedParsedBody = parsePostBodyActionOutput(
        repairPreview.rawResponse ?? repairPreview.markdown,
      );
      if (repairedParsedBody.error) {
        throw new Error(`post_body quality repair output invalid: ${repairedParsedBody.error}`);
      }
      parsedBody = repairedParsedBody;
      bodyPreview = repairPreview;

      const repairedAuditPreview = await invokeStage({
        taskType: "post_body",
        stagePurpose: "audit",
        taskContext: buildPostBodyAuditPrompt({
          boardContextText: promptContext.boardContextText,
          selectedPostPlanText,
          renderedFinalPost: renderFinalPostForAudit({
            title: selectedPostPlan.title,
            body: parsedBody.body,
            tags: parsedBody.tags,
          }),
          personaEvidence: input.personaEvidence,
        }),
        targetContextText: selectedPostPlanText,
      });
      const repairedAudit = parsePostBodyAuditResult(
        repairedAuditPreview.rawResponse ?? repairedAuditPreview.markdown,
      );
      if (!repairedAudit.passes) {
        throw new Error("post_body audit failed after repair");
      }
      bodyAuditResult = {
        status: "passed_after_repair",
        repairApplied: true,
        issues: initialAudit.issues,
        contentChecks: repairedAudit.contentChecks,
        personaChecks: repairedAudit.personaChecks,
      };
    } else {
      bodyAuditResult = {
        status: "passed",
        repairApplied: false,
        issues: initialAudit.issues,
        contentChecks: initialAudit.contentChecks,
        personaChecks: initialAudit.personaChecks,
      };
    }
    stageResults.push({ stage: "post_body", status: "passed" });
  } catch (error) {
    stageResults.push({ stage: "post_body", status: "failed" });
    const failure = error instanceof Error ? error : new Error(String(error));
    throw new TextFlowExecutionError({
      message: failure.message,
      flowKind: "post",
      diagnostics: {
        finalStatus: "failed",
        terminalStage: "post_body",
        attempts: [planningAttempt, bodyAttempt],
        stageResults,
        gate: gateResult,
        planningAudit: planningAuditResult,
      },
      causeCategory: classifyPostFailure(failure),
      cause: failure,
    });
  }

  const preview = bodyPreview;

  const diagnostics: FlowDiagnostics = {
    finalStatus: "passed",
    terminalStage: "post_body",
    attempts: [planningAttempt, bodyAttempt],
    stageResults,
    gate: gateResult,
    planningAudit: planningAuditResult,
    planningCandidates:
      finalPlanningOutput?.candidates.map((candidate, candidateIndex) => {
        const overallScore = computePostPlanOverallScore(candidate);
        return {
          candidateIndex,
          title: candidate.title,
          overallScore,
          passedHardGate: gateResult.passedCandidateIndexes.includes(candidateIndex),
          scores: {
            boardFit: candidate.boardFitScore,
            titlePersonaFit: candidate.titlePersonaFitScore,
            titleNovelty: candidate.titleNoveltyScore,
            angleNovelty: candidate.angleNoveltyScore,
            bodyUsefulness: candidate.bodyUsefulnessScore,
          },
        };
      }) ?? [],
    bodyAudit: bodyAuditResult
      ? {
          contract: "post_body_audit",
          status: bodyAuditResult.status,
          repairApplied: bodyAuditResult.repairApplied,
          issues: bodyAuditResult.issues,
          contentChecks: bodyAuditResult.contentChecks,
          personaChecks: bodyAuditResult.personaChecks,
        }
      : undefined,
  };

  return {
    promptContext,
    preview,
    flowResult: {
      flowKind: "post",
      parsed: {
        selectedPostPlan,
        postBody: {
          body: parsedBody.body,
          tags: parsedBody.tags,
          needImage: parsedBody.imageRequest.needImage,
          imagePrompt: parsedBody.imageRequest.imagePrompt,
          imageAlt: parsedBody.imageRequest.imageAlt,
        },
        renderedPost: {
          title: selectedPostPlan.title,
          body: parsedBody.body,
          tags: parsedBody.tags,
          needImage: parsedBody.imageRequest.needImage,
          imagePrompt: parsedBody.imageRequest.imagePrompt,
          imageAlt: parsedBody.imageRequest.imageAlt,
        },
      },
      diagnostics,
    },
    modelSelection,
    modelMetadata: {
      ...buildModuleMetadata({
        modelSelection,
        preview,
        task: input.task,
        flowKind: "post",
      }),
      stage_mode: mode,
      selected_post_plan: selectedPostPlan,
      gate: diagnostics.gate,
    },
  };
}

export function createPostFlowModule(): TextFlowModule {
  return {
    flowKind: "post",
    runPreview: (input) => runPostFlow(input, "preview"),
    runRuntime: (input) => runPostFlow(input, "runtime"),
  };
}
