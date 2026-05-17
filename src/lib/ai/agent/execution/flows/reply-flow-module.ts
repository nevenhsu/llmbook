import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type { ContentMode } from "@/lib/ai/core/persona-core-v2";
import { buildReplyStageTaskContext } from "@/lib/ai/prompt-runtime/reply/reply-prompt-builder";
import type {
  FlowDiagnostics,
  ReplyOutput,
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

function classifyReplyFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("did not produce a valid markdown body")) {
    return "empty_output";
  }
  if (error.message.includes("invalid") || error.message.includes("expected")) {
    return "schema_validation";
  }
  return "transport";
}

function requireReplyOutput(parsed: ReturnType<typeof parseMarkdownActionOutput>) {
  if (!parsed.output?.markdown?.trim()) {
    throw new Error("reply flow did not produce a valid markdown body");
  }
  return parsed.output;
}

function buildFreshRegenerateTaskContext(baseTaskContext: string) {
  return [
    baseTaskContext,
    "[fresh_regenerate]",
    "Generate a fresh thread reply from scratch.",
    "Do not reuse the previous wording or framing.",
  ].join("\n\n");
}

function resolveReplyContentMode(input: TextFlowModuleRunInput): ContentMode {
  return typeof input.task.payload?.contentMode === "string" &&
    input.task.payload.contentMode === "story"
    ? "story"
    : "discussion";
}

function resolveReplyTaskContext(input: {
  promptContextTaskContext?: string;
  contentMode: ContentMode;
}): string {
  return input.promptContextTaskContext?.trim()
    ? input.promptContextTaskContext
    : buildReplyStageTaskContext({
        stage: "reply_body",
        contentMode: input.contentMode,
      });
}

async function runReplyFlow(
  input: TextFlowModuleRunInput,
  mode: "preview" | "runtime",
): Promise<TextFlowModuleRunResult> {
  const promptContext = mergeFlowTaskContext({
    promptContext: input.promptContext,
    extraInstructions: input.extraInstructions,
  });
  const modelSelection = await input.loadPreferredTextModel();
  const contentMode = resolveReplyContentMode(input);
  const baseTaskContext = resolveReplyTaskContext({
    promptContextTaskContext: promptContext.taskContext,
    contentMode,
  });
  const attempt = {
    stage: "reply_body" as const,
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
        flow: "reply",
        stage: "reply_body",
        stagePurpose: "main",
        taskContext: regenerateAttempt
          ? buildFreshRegenerateTaskContext(baseTaskContext)
          : baseTaskContext,
        boardContextText: promptContext.boardContextText,
        targetContextText: promptContext.targetContextText,
        debug: input.debug,
        attemptLabel: "reply_body.main",
        executionMode: mode === "runtime" ? "runtime" : "admin_preview",
        contentMode,
      });
      collectDebugRecords(preview);
      const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      const parsedOutput = requireReplyOutput(parsed);

      const diagnostics: FlowDiagnostics = {
        finalStatus: "passed",
        terminalStage: "reply_body",
        attempts: [attempt],
        stageResults: [{ stage: "reply_body", status: "passed" }],
      };

      return {
        promptContext,
        preview,
        flowResult: {
          flowKind: "reply",
          parsed: {
            reply: {
              markdown: parsedOutput.markdown,
              needImage: parsedOutput.imageRequest.needImage,
              imagePrompt: parsedOutput.imageRequest.imagePrompt,
              imageAlt: parsedOutput.imageRequest.imageAlt,
              metadata: parsedOutput.metadata ?? { probability: 0 },
            } satisfies ReplyOutput,
          },
          diagnostics,
        },
        modelSelection,
        modelMetadata: {
          ...buildModuleMetadata({
            modelSelection,
            preview,
            task: input.task,
            flowKind: "reply",
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

  const failure = lastError ?? new Error("reply flow failed");
  const diagnostics: FlowDiagnostics = {
    finalStatus: "failed",
    terminalStage: "reply_body",
    attempts: [attempt],
    stageResults: [{ stage: "reply_body", status: "failed" }],
  };
  throw new TextFlowExecutionError({
    message: failure.message,
    flowKind: "reply",
    diagnostics,
    causeCategory: classifyReplyFailure(failure),
    cause: failure,
    stageDebugRecords: stageDebugRecords.length > 0 ? stageDebugRecords : undefined,
  });
}

export function createReplyFlowModule(): TextFlowModule {
  return {
    flowKind: "reply",
    runPreview: (input) => runReplyFlow(input, "preview"),
    runRuntime: (input) => runReplyFlow(input, "runtime"),
  };
}
