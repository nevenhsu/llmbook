import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";
import { buildCommentStageTaskContext } from "@/lib/ai/prompt-runtime/comment/comment-prompt-builder";
import type {
  CommentOutput,
  FlowDiagnostics,
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

function classifyCommentFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("did not produce a valid markdown body")) {
    return "empty_output";
  }
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
  }
  return "transport";
}

function requireCommentOutput(parsed: ReturnType<typeof parseMarkdownActionOutput>) {
  if (!parsed.output?.markdown?.trim()) {
    throw new Error("comment flow did not produce a valid markdown body");
  }
  return parsed.output;
}

function buildFreshRegenerateTaskContext(baseTaskContext: string) {
  return [
    baseTaskContext,
    "[fresh_regenerate]",
    "Generate a fresh top-level comment from scratch.",
    "Do not reuse the previous wording or framing.",
  ].join("\n\n");
}

function resolveCommentContentMode(input: TextFlowModuleRunInput): ContentMode {
  return typeof input.task.payload?.contentMode === "string" &&
    input.task.payload.contentMode === "story"
    ? "story"
    : "discussion";
}

function resolveCommentTaskContext(input: {
  promptContextTaskContext?: string;
  contentMode: ContentMode;
}): string {
  return input.promptContextTaskContext?.trim()
    ? input.promptContextTaskContext
    : buildCommentStageTaskContext({
        stage: "comment_body",
        contentMode: input.contentMode,
      });
}

async function runCommentFlow(
  input: TextFlowModuleRunInput,
  mode: "preview" | "runtime",
): Promise<TextFlowModuleRunResult> {
  const promptContext = mergeFlowTaskContext({
    promptContext: input.promptContext,
    extraInstructions: input.extraInstructions,
  });
  const modelSelection = await input.loadPreferredTextModel();
  const contentMode = resolveCommentContentMode(input);
  const baseTaskContext = resolveCommentTaskContext({
    promptContextTaskContext: promptContext.taskContext,
    contentMode,
  });
  const attempt = {
    stage: "comment_body" as const,
    main: 0,
    regenerate: 0,
  };
  const stageDebugRecords: StageDebugRecord[] = [];

  const collectDebugRecords = (
    preview: Awaited<ReturnType<typeof input.runPersonaInteractionStage>>,
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
      const preview = await input.runPersonaInteractionStage({
        personaId: input.task.personaId,
        modelId: modelSelection.modelId,
        flow: "comment",
        stage: "comment_body",
        stagePurpose: "main",
        taskContext: regenerateAttempt
          ? buildFreshRegenerateTaskContext(baseTaskContext)
          : baseTaskContext,
        boardContextText: promptContext.boardContextText,
        targetContextText: promptContext.targetContextText,
        debug: input.debug,
        attemptLabel: "comment_body.main",
        executionMode: mode === "runtime" ? "runtime" : "admin_preview",
        contentMode,
      });
      collectDebugRecords(preview);
      const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      const parsedOutput = requireCommentOutput(parsed);

      const diagnostics: FlowDiagnostics = {
        finalStatus: "passed",
        terminalStage: "comment_body",
        attempts: [attempt],
        stageResults: [{ stage: "comment_body", status: "passed" }],
      };

      return {
        promptContext,
        preview,
        flowResult: {
          flowKind: "comment",
          parsed: {
            comment: {
              markdown: parsedOutput.markdown,
              needImage: parsedOutput.imageRequest.needImage,
              imagePrompt: parsedOutput.imageRequest.imagePrompt,
              imageAlt: parsedOutput.imageRequest.imageAlt,
              metadata: parsedOutput.metadata ?? { probability: 0 },
            } satisfies CommentOutput,
          },
          diagnostics,
        },
        modelSelection,
        modelMetadata: {
          ...buildModuleMetadata({
            modelSelection,
            preview,
            task: input.task,
            flowKind: "comment",
          }),
          stage_mode: mode,
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

  const failure = lastError ?? new Error("comment flow failed");
  const diagnostics: FlowDiagnostics = {
    finalStatus: "failed",
    terminalStage: "comment_body",
    attempts: [attempt],
    stageResults: [{ stage: "comment_body", status: "failed" }],
  };
  throw new TextFlowExecutionError({
    message: failure.message,
    flowKind: "comment",
    diagnostics,
    causeCategory: classifyCommentFailure(failure),
    cause: failure,
    stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
  });
}

export function createCommentFlowModule(): TextFlowModule {
  return {
    flowKind: "comment",
    runPreview: (input) => runCommentFlow(input, "preview"),
    runRuntime: (input) => runCommentFlow(input, "runtime"),
  };
}
