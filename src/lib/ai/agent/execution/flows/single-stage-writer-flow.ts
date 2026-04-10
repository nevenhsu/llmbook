import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import type { PreviewResult } from "@/lib/ai/admin/control-plane-store";
import type {
  CommentOutput,
  FlowDiagnostics,
  ReplyOutput,
  TextFlowKind,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import { buildModuleMetadata, mergeFlowTaskContext } from "@/lib/ai/agent/execution/flows/types";

type SingleStageWriterFlowKind = Extract<TextFlowKind, "comment" | "reply">;

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

function readAuditSummary(
  preview: PreviewResult,
  flowKind: SingleStageWriterFlowKind,
): FlowDiagnostics["audit"] {
  const diagnostics = preview.auditDiagnostics;
  const expectedContract = flowKind === "comment" ? "comment_audit" : "reply_audit";
  if (diagnostics?.contract !== expectedContract || !diagnostics.checks) {
    return undefined;
  }

  return {
    contract: expectedContract,
    status: diagnostics.status,
    repairApplied: diagnostics.repairApplied,
    issues: diagnostics.issues,
    checks: diagnostics.checks,
  };
}

function mapParsedOutput(
  flowKind: SingleStageWriterFlowKind,
  markdown: string,
  imageRequest: {
    needImage: boolean;
    imagePrompt: string | null;
    imageAlt: string | null;
  },
): { comment: CommentOutput } | { reply: ReplyOutput } {
  const shared = {
    markdown,
    needImage: imageRequest.needImage,
    imagePrompt: imageRequest.imagePrompt,
    imageAlt: imageRequest.imageAlt,
  };

  return flowKind === "comment" ? { comment: shared } : { reply: shared };
}

export async function runSingleStageWriterFlow(input: {
  flowKind: SingleStageWriterFlowKind;
  taskType: "comment" | "reply";
  stage: string;
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
    schemaRepair: 0,
    repair: 0,
    regenerate: 0,
  };
  let lastError: Error | null = null;

  const invokeGeneration = async (taskContext: string) =>
    input.moduleInput.runPersonaInteraction({
      personaId: input.moduleInput.task.personaId,
      modelId: modelSelection.modelId,
      taskType: input.taskType,
      taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: promptContext.targetContextText,
    });

  for (const regenerateAttempt of [false, true] as const) {
    attempt.main += 1;
    if (regenerateAttempt) {
      attempt.regenerate += 1;
    }

    try {
      const preview = await invokeGeneration(
        regenerateAttempt
          ? buildFreshRegenerateTaskContext(promptContext.taskContext, input.flowKind)
          : promptContext.taskContext,
      );
      if (preview.auditDiagnostics?.repairApplied) {
        attempt.repair += 1;
      }

      const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      if (!parsed.markdown.trim()) {
        throw new Error(`${input.flowKind} flow did not produce a valid markdown body`);
      }

      const diagnostics: FlowDiagnostics = {
        finalStatus: "passed",
        terminalStage: input.stage,
        attempts: [attempt],
        stageResults: [{ stage: input.stage, status: "passed" }],
        audit: readAuditSummary(preview, input.flowKind),
      };

      return {
        promptContext,
        preview,
        flowResult:
          input.flowKind === "comment"
            ? {
                flowKind: "comment",
                parsed: mapParsedOutput("comment", parsed.markdown, parsed.imageRequest) as {
                  comment: CommentOutput;
                },
                diagnostics,
              }
            : {
                flowKind: "reply",
                parsed: mapParsedOutput("reply", parsed.markdown, parsed.imageRequest) as {
                  reply: ReplyOutput;
                },
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
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (regenerateAttempt) {
        break;
      }
    }
  }

  throw lastError ?? new Error(`${input.flowKind} flow failed`);
}
