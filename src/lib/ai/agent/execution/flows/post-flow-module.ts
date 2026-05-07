import { parsePostBodyActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import {
  buildPostBodyAuditPrompt,
  buildPostBodyRepairPrompt,
  parsePostBodyAuditResult,
} from "@/lib/ai/prompt-runtime/post-body-audit";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";
import {
  computePostPlanOverallScore,
  parsePostPlanActionOutput,
  pickBestCandidate,
  validatePostPlanOutput,
  type PostPlanCandidate,
} from "@/lib/ai/prompt-runtime/post-plan-contract";
import {
  buildPostPlanAuditPrompt,
  buildPostPlanRepairPrompt,
  parsePostPlanAuditResult,
} from "@/lib/ai/prompt-runtime/post-plan-audit";
import type {
  FlowDiagnostics,
  SelectedPostPlan,
  TextFlowExecutionErrorCauseCategory,
  TextFlowModule,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";
import {
  TextFlowExecutionError,
  buildModuleMetadata,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

function buildSelectedPostPlan(candidate: PostPlanCandidate): SelectedPostPlan {
  return {
    title: candidate.title,
    thesis: candidate.thesis,
    bodyOutline: candidate.bodyOutline,
  };
}

function buildSelectedPostPlanBlock(plan: SelectedPostPlan): string {
  return [
    "[selected_post_plan]",
    `Locked title: ${plan.title}`,
    `Thesis: ${plan.thesis}`,
    "Body outline:",
    ...plan.bodyOutline.map((item) => `- ${item}`),
    "Do not change the title or topic.",
  ].join("\n");
}

function buildPlanningTaskContext(baseTaskContext: string): string {
  return [
    baseTaskContext,
    "This is the planning stage only.",
    "Return 2-3 candidates, score conservatively, and do not write the final post body.",
  ].join("\n\n");
}

function buildPlanningSchemaRepairTaskContext(
  baseTaskContext: string,
  previousOutput: string,
): string {
  const trimmed =
    previousOutput.length <= 800
      ? previousOutput
      : `${previousOutput.slice(0, 500)}\n...[truncated]...`;

  return [
    buildPlanningTaskContext(baseTaskContext),
    "[retry_repair]",
    "Your previous post_plan response did not satisfy the required JSON contract.",
    "Rewrite it as exactly one valid JSON object with 2-3 candidates.",
    "Do not add extra keys.",
    "",
    "[previous_invalid_response]",
    trimmed,
  ].join("\n");
}

function buildPostBodyTaskContext(): string {
  return [
    "Write the final post body for the selected plan below.",
    "The title is locked by the app and must not be changed.",
    "Expand the chosen thesis faithfully.",
    "Write markdown that carries a clear claim, structure, and concrete usefulness.",
  ].join("\n");
}

function buildPostBodySchemaRepairTaskContext(previousOutput: string): string {
  const trimmed =
    previousOutput.length <= 800
      ? previousOutput
      : `${previousOutput.slice(0, 500)}\n...[truncated]...`;

  return [
    buildPostBodyTaskContext(),
    "[retry_repair]",
    "Your previous post_body response did not satisfy the required JSON contract.",
    "Rewrite it as exactly one valid JSON object.",
    "Required keys: body, tags, need_image, image_prompt, image_alt.",
    "Do not output title.",
    "",
    "[previous_invalid_response]",
    trimmed,
  ].join("\n");
}

function renderFinalPostForAudit(input: { title: string; body: string; tags: string[] }): string {
  return [`# ${input.title}`, input.tags.join(" ").trim() || null, input.body.trim()]
    .filter((part): part is string => Boolean(part))
    .join("\n\n")
    .trim();
}

function classifyPostFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error instanceof PersonaOutputValidationError) {
    switch (error.code) {
      case "persona_audit_invalid":
        return "semantic_audit";
      case "persona_repair_failed":
      case "persona_repair_invalid":
        return "quality_repair";
      case "schema_validation_failed":
        return "schema_validation";
      default:
        return "transport";
    }
  }
  if (error.message.includes("quality repair")) {
    return "quality_repair";
  }
  if (error.message.includes("audit failed") || error.message.includes("audit")) {
    return "semantic_audit";
  }
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
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
  const stageDebugRecords: StageDebugRecord[] = [];

  const collectDebugRecords = (preview: Awaited<ReturnType<typeof invokeStage>>) => {
    if (preview.stageDebugRecords && preview.stageDebugRecords.length > 0) {
      for (const record of preview.stageDebugRecords) {
        stageDebugRecords.push(record);
      }
    }
  };

  const invokeStage = async (stageInput: {
    taskType: "post_plan" | "post_body";
    stagePurpose: "main" | "schema_repair" | "audit" | "quality_repair";
    taskContext: string;
    targetContextText?: string;
    attemptLabel?: string;
  }) =>
    input.runPersonaInteractionStage({
      personaId: input.task.personaId,
      modelId: modelSelection.modelId,
      taskType: stageInput.taskType,
      stagePurpose: stageInput.stagePurpose,
      taskContext: stageInput.taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: stageInput.targetContextText,
      debug: input.debug,
      attemptLabel: stageInput.attemptLabel,
      executionMode: mode === "runtime" ? "runtime" : "admin_preview",
    });

  const runPlanningAttempt = async (
    taskContext: string,
  ): Promise<{
    preview: Awaited<ReturnType<typeof invokeStage>>;
    parsed: NonNullable<ReturnType<typeof parsePostPlanActionOutput>["output"]>;
    validationIssues: string[];
  }> => {
    planningAttempt.main += 1;
    let preview = await invokeStage({
      taskType: "post_plan",
      stagePurpose: "main",
      taskContext,
      targetContextText: promptContext.targetContextText,
      attemptLabel: "post_plan.main",
    });
    collectDebugRecords(preview);
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
        attemptLabel: "post_plan.schema_repair",
      });
      collectDebugRecords(preview);
      parsed = parsePostPlanActionOutput(preview.rawResponse ?? preview.markdown);
      validationIssues = parsed.output
        ? validatePostPlanOutput(parsed.output)
        : [parsed.error ?? "invalid post_plan output"];
    }

    if (!parsed.output || validationIssues.length > 0) {
      throw new Error(validationIssues[0] ?? parsed.error ?? "post_plan stage failed");
    }

    return {
      preview,
      parsed: parsed.output,
      validationIssues,
    };
  };

  let finalPlanningOutput: { candidates: PostPlanCandidate[] } | null = null;
  let planningAuditResult: FlowDiagnostics["planningAudit"] | undefined;
  let selectedCandidate: PostPlanCandidate | null = null;
  let selectedCandidateIndex: number | null = null;
  let gateResult = {
    attempted: true,
    selectedCandidateIndex: null as number | null,
  };

  try {
    const firstPlanning = await runPlanningAttempt(
      buildPlanningTaskContext(promptContext.taskContext),
    );
    let activePlanning = firstPlanning;

    const best = pickBestCandidate(firstPlanning.parsed);
    if (best.selectedCandidateIndex === null || firstPlanning.parsed.candidates.length === 0) {
      throw new Error("post_plan stage failed: no valid candidates");
    }
    let bestCandidate = firstPlanning.parsed.candidates[best.selectedCandidateIndex];
    selectedCandidateIndex = best.selectedCandidateIndex;

    const auditPreview = await invokeStage({
      taskType: "post_plan",
      stagePurpose: "audit",
      taskContext: buildPostPlanAuditPrompt({
        candidate: bestCandidate,
      }),
      attemptLabel: "post_plan.audit",
    });
    collectDebugRecords(auditPreview);
    const firstAudit = parsePostPlanAuditResult(auditPreview.rawResponse ?? auditPreview.markdown);

    if (!firstAudit.passes) {
      planningAttempt.repair += 1;
      const repairPreview = await invokeStage({
        taskType: "post_plan",
        stagePurpose: "quality_repair",
        taskContext: buildPostPlanRepairPrompt({
          issues: firstAudit.issues,
          repairGuidance: firstAudit.repairGuidance,
          previousOutput: firstPlanning.preview.rawResponse ?? firstPlanning.preview.markdown,
        }),
        attemptLabel: "post_plan.repair",
      });
      collectDebugRecords(repairPreview);
      const repairedParsed = parsePostPlanActionOutput(
        repairPreview.rawResponse ?? repairPreview.markdown,
      );
      if (!repairedParsed.output || validatePostPlanOutput(repairedParsed.output).length > 0) {
        planningAuditResult = {
          contract: "post_plan_audit",
          status: "failed",
          repairApplied: true,
          issues: firstAudit.issues,
          checks: firstAudit.checks,
        };
        throw new Error("post_plan audit failed after repair");
      }

      const repairedBest = pickBestCandidate(repairedParsed.output);
      if (repairedBest.selectedCandidateIndex === null) {
        planningAuditResult = {
          contract: "post_plan_audit",
          status: "failed",
          repairApplied: true,
          issues: firstAudit.issues,
          checks: firstAudit.checks,
        };
        throw new Error("post_plan repair produced no valid candidates");
      }
      bestCandidate = repairedParsed.output.candidates[repairedBest.selectedCandidateIndex];
      selectedCandidateIndex = repairedBest.selectedCandidateIndex;

      const repairedAuditPreview = await invokeStage({
        taskType: "post_plan",
        stagePurpose: "audit",
        taskContext: buildPostPlanAuditPrompt({
          candidate: bestCandidate,
        }),
        attemptLabel: "post_plan.audit_repair",
      });
      collectDebugRecords(repairedAuditPreview);
      const repairedAudit = parsePostPlanAuditResult(
        repairedAuditPreview.rawResponse ?? repairedAuditPreview.markdown,
      );

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
      activePlanning = { ...activePlanning, parsed: repairedParsed.output };
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
      selectedCandidateIndex,
    };
    selectedCandidate = bestCandidate;

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
      stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
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
          body_usefulness: "pass" | "fail";
          markdown_structure: "pass" | "fail";
        };
        personaChecks: {
          body_persona_fit: "pass" | "fail";
          anti_style_compliance: "pass" | "fail";
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
      attemptLabel: "post_body.main",
    });
    collectDebugRecords(bodyPreview);
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
        attemptLabel: "post_body.schema_repair",
      });
      collectDebugRecords(bodyPreview);
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
        selectedPostPlanText,
        renderedFinalPost: renderFinalPostForAudit({
          title: selectedPostPlan.title,
          body: parsedBody.body,
          tags: parsedBody.tags,
        }),
      }),
      attemptLabel: "post_body.audit",
    });
    collectDebugRecords(initialAuditPreview);
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
          issues: initialAudit.issues,
          repairGuidance: initialAudit.repairGuidance,
          previousOutput: bodyPreview.rawResponse ?? bodyPreview.markdown,
        }),
        attemptLabel: "post_body.quality_repair",
      });
      collectDebugRecords(repairPreview);
      const previousJson = bodyPreview.rawResponse ?? bodyPreview.markdown;
      const repairText = repairPreview.rawResponse ?? repairPreview.markdown;
      let repairedParsedBody = parsePostBodyActionOutput(repairText);
      if (repairedParsedBody.error) {
        try {
          const prevParsed = JSON.parse(previousJson);
          const repairParsed = JSON.parse(repairText);
          const merged = { ...prevParsed, ...repairParsed };
          repairedParsedBody = parsePostBodyActionOutput(JSON.stringify(merged));
        } catch {
          throw new Error(`post_body quality repair output invalid: ${repairedParsedBody.error}`);
        }
      }
      if (repairedParsedBody.error) {
        throw new Error(`post_body quality repair output invalid: ${repairedParsedBody.error}`);
      }
      parsedBody = repairedParsedBody;
      bodyPreview = repairPreview;

      const repairedAuditPreview = await invokeStage({
        taskType: "post_body",
        stagePurpose: "audit",
        taskContext: buildPostBodyAuditPrompt({
          selectedPostPlanText,
          renderedFinalPost: renderFinalPostForAudit({
            title: selectedPostPlan.title,
            body: parsedBody.body,
            tags: parsedBody.tags,
          }),
        }),
        attemptLabel: "post_body.audit_repair",
      });
      collectDebugRecords(repairedAuditPreview);
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
      stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
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
          passedHardGate: true,
          scores: {
            personaFit: candidate.personaFitScore,
            novelty: candidate.noveltyScore,
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
    stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
  };
}

export function createPostFlowModule(): TextFlowModule {
  return {
    flowKind: "post",
    runPreview: (input) => runPostFlow(input, "preview"),
    runRuntime: (input) => runPostFlow(input, "runtime"),
  };
}
