import { parseMarkdownActionOutput } from "@/lib/ai/prompt-runtime/action-output";
import {
  buildCommentAuditPrompt,
  buildCommentRepairPrompt,
  parseCommentAuditResult,
} from "@/lib/ai/prompt-runtime/comment-flow-audit";
import {
  buildReplyAuditPrompt,
  buildReplyRepairPrompt,
  parseReplyAuditResult,
} from "@/lib/ai/prompt-runtime/reply-flow-audit";
import type {
  CommentOutput,
  FlowDiagnostics,
  ReplyOutput,
  TextFlowKind,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import {
  buildFallbackPersonaEvidence,
  buildModuleMetadata,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

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

function extractTargetBlock(
  targetContextText: string | undefined,
  blockName: string,
): string | null {
  const source = targetContextText ?? "";
  const marker = `[${blockName}]`;
  const start = source.indexOf(marker);
  if (start < 0) {
    return null;
  }
  const rest = source.slice(start + marker.length);
  const nextOffset = rest.search(/\n\[[^\n]+\]/);
  return nextOffset === -1
    ? source.slice(start).trim()
    : source.slice(start, start + marker.length + nextOffset).trim();
}

async function runAuditRepairLoop(input: {
  flowKind: SingleStageWriterFlowKind;
  parsed: ReturnType<typeof parseMarkdownActionOutput>;
  promptContext: ReturnType<typeof mergeFlowTaskContext>;
  moduleInput: TextFlowModuleRunInput;
  modelId: string;
  attempt: { repair: number };
}): Promise<{
  parsed: ReturnType<typeof parseMarkdownActionOutput>;
  audit: FlowDiagnostics["audit"];
}> {
  const personaEvidence = buildFallbackPersonaEvidence({
    personaDisplayName: input.moduleInput.task.personaDisplayName ?? null,
    personaUsername: input.moduleInput.task.personaUsername ?? null,
  });
  const sharedAuditCall = async (taskContext: string) =>
    input.moduleInput.runPersonaInteraction({
      personaId: input.moduleInput.task.personaId,
      modelId: input.modelId,
      taskType: input.flowKind,
      taskContext,
      boardContextText: input.promptContext.boardContextText,
      targetContextText: input.promptContext.targetContextText,
    });

  if (input.flowKind === "comment") {
    const auditPrompt = buildCommentAuditPrompt({
      personaEvidence,
      rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
      recentTopLevelCommentsText: extractTargetBlock(
        input.promptContext.targetContextText,
        "recent_top_level_comments",
      ),
      generatedComment: input.parsed.markdown,
    });
    const auditPreview = await sharedAuditCall(auditPrompt);
    const audit = parseCommentAuditResult(auditPreview.rawResponse ?? auditPreview.markdown);
    if (audit.passes) {
      return {
        parsed: input.parsed,
        audit: {
          contract: "comment_audit",
          status: "passed",
          repairApplied: false,
          issues: audit.issues,
          checks: audit.checks,
        },
      };
    }
    input.attempt.repair += 1;
    const repairPreview = await sharedAuditCall(
      buildCommentRepairPrompt({
        personaEvidence,
        rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
        recentTopLevelCommentsText: extractTargetBlock(
          input.promptContext.targetContextText,
          "recent_top_level_comments",
        ),
        issues: audit.issues,
        repairGuidance: audit.repairGuidance,
        previousOutput: input.parsed.markdown,
      }),
    );
    const repairedParsed = parseMarkdownActionOutput(
      repairPreview.rawResponse ?? repairPreview.markdown,
    );
    const repairedAuditPreview = await sharedAuditCall(
      buildCommentAuditPrompt({
        personaEvidence,
        rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
        recentTopLevelCommentsText: extractTargetBlock(
          input.promptContext.targetContextText,
          "recent_top_level_comments",
        ),
        generatedComment: repairedParsed.markdown,
      }),
    );
    const repairedAudit = parseCommentAuditResult(
      repairedAuditPreview.rawResponse ?? repairedAuditPreview.markdown,
    );
    if (!repairedAudit.passes) {
      throw new Error("comment audit failed after repair");
    }
    return {
      parsed: repairedParsed,
      audit: {
        contract: "comment_audit",
        status: "passed_after_repair",
        repairApplied: true,
        issues: audit.issues,
        checks: repairedAudit.checks,
      },
    };
  }

  const auditPrompt = buildReplyAuditPrompt({
    personaEvidence,
    sourceCommentText: extractTargetBlock(input.promptContext.targetContextText, "source_comment"),
    ancestorCommentsText: extractTargetBlock(
      input.promptContext.targetContextText,
      "ancestor_comments",
    ),
    generatedReply: input.parsed.markdown,
  });
  const auditPreview = await sharedAuditCall(auditPrompt);
  const audit = parseReplyAuditResult(auditPreview.rawResponse ?? auditPreview.markdown);
  if (audit.passes) {
    return {
      parsed: input.parsed,
      audit: {
        contract: "reply_audit",
        status: "passed",
        repairApplied: false,
        issues: audit.issues,
        checks: audit.checks,
      },
    };
  }
  input.attempt.repair += 1;
  const repairPreview = await sharedAuditCall(
    buildReplyRepairPrompt({
      personaEvidence,
      sourceCommentText: extractTargetBlock(
        input.promptContext.targetContextText,
        "source_comment",
      ),
      ancestorCommentsText: extractTargetBlock(
        input.promptContext.targetContextText,
        "ancestor_comments",
      ),
      issues: audit.issues,
      repairGuidance: audit.repairGuidance,
      previousOutput: input.parsed.markdown,
    }),
  );
  const repairedParsed = parseMarkdownActionOutput(
    repairPreview.rawResponse ?? repairPreview.markdown,
  );
  const repairedAuditPreview = await sharedAuditCall(
    buildReplyAuditPrompt({
      personaEvidence,
      sourceCommentText: extractTargetBlock(
        input.promptContext.targetContextText,
        "source_comment",
      ),
      ancestorCommentsText: extractTargetBlock(
        input.promptContext.targetContextText,
        "ancestor_comments",
      ),
      generatedReply: repairedParsed.markdown,
    }),
  );
  const repairedAudit = parseReplyAuditResult(
    repairedAuditPreview.rawResponse ?? repairedAuditPreview.markdown,
  );
  if (!repairedAudit.passes) {
    throw new Error("reply audit failed after repair");
  }
  return {
    parsed: repairedParsed,
    audit: {
      contract: "reply_audit",
      status: "passed_after_repair",
      repairApplied: true,
      issues: audit.issues,
      checks: repairedAudit.checks,
    },
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
      const parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      if (!parsed.markdown.trim()) {
        throw new Error(`${input.flowKind} flow did not produce a valid markdown body`);
      }

      const audited = await runAuditRepairLoop({
        flowKind: input.flowKind,
        parsed,
        promptContext,
        moduleInput: input.moduleInput,
        modelId: modelSelection.modelId,
        attempt,
      });

      const diagnostics: FlowDiagnostics = {
        finalStatus: "passed",
        terminalStage: input.stage,
        attempts: [attempt],
        stageResults: [{ stage: input.stage, status: "passed" }],
        audit: audited.audit,
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
                  audited.parsed.markdown,
                  audited.parsed.imageRequest,
                ) as {
                  comment: CommentOutput;
                },
                diagnostics,
              }
            : {
                flowKind: "reply",
                parsed: mapParsedOutput(
                  "reply",
                  audited.parsed.markdown,
                  audited.parsed.imageRequest,
                ) as {
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
