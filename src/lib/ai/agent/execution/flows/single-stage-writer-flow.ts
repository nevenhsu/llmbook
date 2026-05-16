import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type {
  CommentOutput,
  FlowDiagnostics,
  ReplyOutput,
  TextFlowExecutionErrorCauseCategory,
  TextFlowKind,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import type { StageDebugRecord } from "@/lib/ai/stage-debug-records";
import {
  TextFlowExecutionError,
  buildModuleMetadata,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

type SingleStageWriterFlowKind = Extract<TextFlowKind, "comment" | "reply">;

function classifySingleStageFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("did not produce a valid markdown body")) {
    return "empty_output";
  }
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
  }
  return "transport";
}

function requireMarkdownOutput(
  parsed: ReturnType<typeof parseMarkdownActionOutput>,
  flowKind: SingleStageWriterFlowKind,
) {
  if (!parsed.output?.markdown?.trim()) {
    throw new Error(`${flowKind} flow did not produce a valid markdown body`);
  }
  return parsed.output;
}

function buildFreshRegenerateTaskContext(
  baseTaskContext: string,
  flowKind: SingleStageWriterFlowKind,
) {
  return [
    baseTaskContext,
    "[fresh_regenerate]",
    flowKind === "comment"
      ? "Generate a fresh top-level comment from scratch."
      : "Generate a fresh thread reply from scratch.",
    "Do not reuse the previous wording or framing.",
  ].join("\n\n");
}

function mapParsedOutput(
  flowKind: SingleStageWriterFlowKind,
  markdown: string,
  imageRequest: {
    needImage: boolean;
    imagePrompt: string | null;
    imageAlt: string | null;
  },
  metadata: { probability: number },
): { comment: CommentOutput } | { reply: ReplyOutput } {
  const shared = {
    markdown,
    needImage: imageRequest.needImage,
    imagePrompt: imageRequest.imagePrompt,
    imageAlt: imageRequest.imageAlt,
    metadata,
  };

  return flowKind === "comment" ? { comment: shared } : { reply: shared };
}

export async function runSingleStageWriterFlow(input: {
  flowKind: SingleStageWriterFlowKind;
  flow: "comment" | "reply";
  stage: "comment_body" | "reply_body";
  mode: "preview" | "runtime";
  moduleInput: TextFlowModuleRunInput;
}): Promise<TextFlowModuleRunResult> {
  const promptContext = mergeFlowTaskContext({
    promptContext: input.moduleInput.promptContext,
    extraInstructions: input.moduleInput.extraInstructions,
  });
  const modelSelection = await input.moduleInput.loadPreferredTextModel();
  const attempt = {
    stage: input.stage,
    main: 0,
    regenerate: 0,
  };
  const stageDebugRecords: StageDebugRecord[] = [];

  const collectDebugRecords = (
    preview: Awaited<ReturnType<typeof input.moduleInput.runPersonaInteractionStage>>,
  ) => {
    if (preview.stageDebugRecords && preview.stageDebugRecords.length > 0) {
      for (const record of preview.stageDebugRecords) {
        stageDebugRecords.push(record);
      }
    }
  };

  let lastError: Error | null = null;

  for (const regenerateAttempt of [false, true] as const) {
    attempt.main += 1;
    if (regenerateAttempt) {
      attempt.regenerate += 1;
    }

    try {
      const preview = await input.moduleInput.runPersonaInteractionStage({
        personaId: input.moduleInput.task.personaId,
        modelId: modelSelection.modelId,
        flow: input.flow,
        stage: input.stage as "comment_body" | "reply_body",
        stagePurpose: "main",
        taskContext: regenerateAttempt
          ? buildFreshRegenerateTaskContext(promptContext.taskContext, input.flowKind)
          : promptContext.taskContext,
        boardContextText: promptContext.boardContextText,
        targetContextText: promptContext.targetContextText,
        debug: input.moduleInput.debug,
        attemptLabel: `${input.stage}.main`,
        executionMode: input.mode === "runtime" ? "runtime" : "admin_preview",
      });
      collectDebugRecords(preview);
      const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      const parsedOutput = requireMarkdownOutput(parsed, input.flowKind);

      const diagnostics: FlowDiagnostics = {
        finalStatus: "passed",
        terminalStage: input.stage,
        attempts: [attempt],
        stageResults: [{ stage: input.stage, status: "passed" }],
      };

      return {
        promptContext,
        preview,
        flowResult:
          input.flowKind === "comment"
            ? {
                flowKind: "comment",
                parsed: mapParsedOutput(
                  "comment",
                  parsedOutput.markdown,
                  parsedOutput.imageRequest,
                  parsedOutput.metadata ?? { probability: 0 },
                ) as { comment: CommentOutput },
                diagnostics,
              }
            : {
                flowKind: "reply",
                parsed: mapParsedOutput(
                  "reply",
                  parsedOutput.markdown,
                  parsedOutput.imageRequest,
                  parsedOutput.metadata ?? { probability: 0 },
                ) as { reply: ReplyOutput },
                diagnostics,
              },
        modelSelection,
        modelMetadata: {
          ...buildModuleMetadata({
            modelSelection,
            preview,
            task: input.moduleInput.task,
            flowKind: input.flowKind,
          }),
          stage_mode: input.mode,
        },
        stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (regenerateAttempt) {
        break;
      }
    }
  }

  const failure = lastError ?? new Error(`${input.flowKind} flow failed`);
  const diagnostics: FlowDiagnostics = {
    finalStatus: "failed",
    terminalStage: input.stage,
    attempts: [attempt],
    stageResults: [{ stage: input.stage, status: "failed" }],
  };
  throw new TextFlowExecutionError({
    message: failure.message,
    flowKind: input.flowKind,
    diagnostics,
    causeCategory: classifySingleStageFailure(failure),
    cause: failure,
    stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
  });
}
