import { parsePostBodyActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import {
  computePostPlanOverallScore,
  parsePostPlanActionOutput,
  pickBestCandidate,
  validatePostPlanOutput,
  type PostPlanCandidate,
} from "@/lib/ai/prompt-runtime/post-plan-contract";
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

function buildPostBodyTaskContext(): string {
  return [
    "Write the final post body for the selected plan below.",
    "The title is locked by the app and must not be changed.",
    "Expand the chosen thesis faithfully.",
    "Write markdown that carries a clear claim, structure, and concrete usefulness.",
  ].join("\n");
}

function classifyPostFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
  }
  if (error.message.includes("empty") || error.message.includes("did not produce")) {
    return "empty_output";
  }
  if (error.message.includes("gate") || error.message.includes("no valid candidates")) {
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
    regenerate: 0,
  };
  const bodyAttempt = {
    stage: "post_body",
    main: 0,
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
    taskContext: string;
    targetContextText?: string;
    attemptLabel?: string;
  }) =>
    input.runPersonaInteractionStage({
      personaId: input.task.personaId,
      modelId: modelSelection.modelId,
      taskType: stageInput.taskType,
      stagePurpose: "main",
      taskContext: stageInput.taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: stageInput.targetContextText,
      debug: input.debug,
      attemptLabel: stageInput.attemptLabel,
      executionMode: mode === "runtime" ? "runtime" : "admin_preview",
    });

  // ---- Planning stage ----
  let finalPlanningOutput: { candidates: PostPlanCandidate[] } | null = null;
  let selectedCandidate: PostPlanCandidate | null = null;
  let selectedCandidateIndex: number | null = null;
  let gateResult = {
    attempted: true,
    selectedCandidateIndex: null as number | null,
  };

  try {
    planningAttempt.main += 1;
    let preview = await invokeStage({
      taskType: "post_plan",
      taskContext: buildPlanningTaskContext(promptContext.taskContext),
      targetContextText: promptContext.targetContextText,
      attemptLabel: "post_plan.main",
    });
    collectDebugRecords(preview);
    const parsed = parsePostPlanActionOutput(preview.rawResponse ?? preview.markdown);
    const validationIssues = parsed.output
      ? validatePostPlanOutput(parsed.output)
      : [parsed.error ?? "invalid post_plan output"];

    if (!parsed.output || validationIssues.length > 0) {
      throw new Error(validationIssues[0] ?? parsed.error ?? "post_plan stage failed");
    }

    const best = pickBestCandidate(parsed.output);
    if (best.selectedCandidateIndex === null || parsed.output.candidates.length === 0) {
      throw new Error("post_plan stage failed: no valid candidates");
    }

    finalPlanningOutput = parsed.output;
    selectedCandidate = parsed.output.candidates[best.selectedCandidateIndex];
    selectedCandidateIndex = best.selectedCandidateIndex;
    gateResult = {
      attempted: true,
      selectedCandidateIndex,
    };

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
      },
      causeCategory: classifyPostFailure(failure),
      cause: failure,
      stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
    });
  }

  // ---- Body stage ----
  const selectedPostPlan = buildSelectedPostPlan(selectedCandidate);
  let bodyPreview;
  let parsedBody;

  try {
    bodyAttempt.main += 1;
    bodyPreview = await invokeStage({
      taskType: "post_body",
      taskContext: buildPostBodyTaskContext(),
      targetContextText: buildSelectedPostPlanBlock(selectedPostPlan),
      attemptLabel: "post_body.main",
    });
    collectDebugRecords(bodyPreview);
    parsedBody = parsePostBodyActionOutput(bodyPreview.rawResponse ?? bodyPreview.markdown);

    if (parsedBody.error) {
      throw new Error(parsedBody.error);
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
          metadata: parsedBody.metadata,
          needImage: parsedBody.imageRequest.needImage,
          imagePrompt: parsedBody.imageRequest.imagePrompt,
          imageAlt: parsedBody.imageRequest.imageAlt,
        },
        renderedPost: {
          title: selectedPostPlan.title,
          body: parsedBody.body,
          tags: parsedBody.tags,
          metadata: parsedBody.metadata,
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
