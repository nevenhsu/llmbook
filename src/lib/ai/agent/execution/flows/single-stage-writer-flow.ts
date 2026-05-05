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
  PersonaGenerationStageDebugRecord,
  ReplyOutput,
  TextFlowExecutionErrorCauseCategory,
  TextFlowKind,
  TextFlowModuleRunInput,
  TextFlowModuleRunResult,
} from "@/lib/ai/agent/execution/flows/types";
import {
  TextFlowExecutionError,
  buildModuleMetadata,
  mergeFlowTaskContext,
} from "@/lib/ai/agent/execution/flows/types";

type SingleStageWriterFlowKind = Extract<TextFlowKind, "comment" | "reply">;

function classifySingleStageFailure(error: Error): TextFlowExecutionErrorCauseCategory {
  if (error.message.includes("quality repair")) {
    return "quality_repair";
  }
  if (error.message.includes("did not produce a valid markdown body")) {
    return "empty_output";
  }
  if (error.message.includes("audit failed") || error.message.includes("audit")) {
    return "semantic_audit";
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

function buildSchemaRepairTaskContext(input: {
  baseTaskContext: string;
  flowKind: SingleStageWriterFlowKind;
  previousOutput: string;
  error: string | null;
}) {
  return [
    input.baseTaskContext,
    "[retry_repair]",
    `Your previous ${input.flowKind} response did not satisfy the required JSON contract.`,
    "Rewrite it as exactly one valid JSON object.",
    "Required keys: markdown, need_image, image_prompt, image_alt.",
    "Do not output prose outside the JSON object.",
    input.error ? `Parser error: ${input.error}` : null,
    "",
    "[previous_invalid_response]",
    input.previousOutput,
  ]
    .filter((part): part is string => part !== null)
    .join("\n");
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
  const nextOffset = rest.search(/\[[^\n]+\]/);
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
  stageDebugRecords: PersonaGenerationStageDebugRecord[];
}): Promise<{
  parsed: ReturnType<typeof parseMarkdownActionOutput>;
  audit: FlowDiagnostics["audit"];
}> {
  const collectDebugRecords = (
    preview: Awaited<ReturnType<typeof input.moduleInput.runPersonaInteractionStage>>,
  ) => {
    if (preview.stageDebugRecords && preview.stageDebugRecords.length > 0) {
      for (const record of preview.stageDebugRecords) {
        input.stageDebugRecords.push(record);
      }
    }
  };

  const sharedAuditCall = async (taskContext: string, attemptLabel?: string) => {
    const result = await input.moduleInput.runPersonaInteractionStage({
      personaId: input.moduleInput.task.personaId,
      modelId: input.modelId,
      taskType: input.flowKind,
      stagePurpose: "audit",
      taskContext,
      boardContextText: input.promptContext.boardContextText,
      targetContextText: input.promptContext.targetContextText,
      debug: input.moduleInput.debug,
      attemptLabel,
    });
    collectDebugRecords(result);
    return result;
  };

  if (input.flowKind === "comment") {
    const auditPrompt = buildCommentAuditPrompt({
      personaEvidence: input.moduleInput.personaEvidence,
      rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
      recentTopLevelCommentsText: extractTargetBlock(
        input.promptContext.targetContextText,
        "recent_top_level_comments",
      ),
      generatedComment: input.parsed.output?.markdown ?? "",
    });
    const auditPreview = await sharedAuditCall(auditPrompt, "comment.audit");
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
        personaEvidence: input.moduleInput.personaEvidence,
        rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
        recentTopLevelCommentsText: extractTargetBlock(
          input.promptContext.targetContextText,
          "recent_top_level_comments",
        ),
        issues: audit.issues,
        repairGuidance: audit.repairGuidance,
        previousOutput: input.parsed.output?.markdown ?? "",
      }),
      "comment.repair",
    );
    const repairedParsed = parseMarkdownActionOutput(
      repairPreview.rawResponse ?? repairPreview.markdown,
    );
    if (!repairedParsed.output?.markdown?.trim() || repairedParsed.error) {
      throw new Error(
        `comment quality repair output did not produce a valid markdown body${
          repairedParsed.error ? `: ${repairedParsed.error}` : ""
        }`,
      );
    }
    const repairedOutput = repairedParsed.output;
    const repairedAuditPreview = await sharedAuditCall(
      buildCommentAuditPrompt({
        personaEvidence: input.moduleInput.personaEvidence,
        rootPostText: extractTargetBlock(input.promptContext.targetContextText, "root_post"),
        recentTopLevelCommentsText: extractTargetBlock(
          input.promptContext.targetContextText,
          "recent_top_level_comments",
        ),
        generatedComment: repairedOutput.markdown,
      }),
      "comment.audit_repair",
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
    personaEvidence: input.moduleInput.personaEvidence,
    sourceCommentText: extractTargetBlock(input.promptContext.targetContextText, "source_comment"),
    ancestorCommentsText: extractTargetBlock(
      input.promptContext.targetContextText,
      "ancestor_comments",
    ),
    generatedReply: input.parsed.output?.markdown ?? "",
  });
  const auditPreview = await sharedAuditCall(auditPrompt, "reply.audit");
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
      personaEvidence: input.moduleInput.personaEvidence,
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
      previousOutput: input.parsed.output?.markdown ?? "",
    }),
    "reply.repair",
  );
  const repairedParsed = parseMarkdownActionOutput(
    repairPreview.rawResponse ?? repairPreview.markdown,
  );
  if (!repairedParsed.output?.markdown?.trim() || repairedParsed.error) {
    throw new Error(
      `reply quality repair output did not produce a valid markdown body${
        repairedParsed.error ? `: ${repairedParsed.error}` : ""
      }`,
    );
  }
  const repairedOutput = repairedParsed.output;
  const repairedAuditPreview = await sharedAuditCall(
    buildReplyAuditPrompt({
      personaEvidence: input.moduleInput.personaEvidence,
      sourceCommentText: extractTargetBlock(
        input.promptContext.targetContextText,
        "source_comment",
      ),
      ancestorCommentsText: extractTargetBlock(
        input.promptContext.targetContextText,
        "ancestor_comments",
      ),
      generatedReply: repairedOutput.markdown,
    }),
    "reply.audit_repair",
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
  const stageDebugRecords: PersonaGenerationStageDebugRecord[] = [];

  const collectDebugRecords = (
    preview: Awaited<ReturnType<typeof input.moduleInput.runPersonaInteractionStage>>,
  ) => {
    if (preview.stageDebugRecords && preview.stageDebugRecords.length > 0) {
      for (const record of preview.stageDebugRecords) {
        stageDebugRecords.push(record);
      }
    }
  };

  const runStage = (stageInput: {
    stagePurpose: "main" | "schema_repair" | "audit" | "quality_repair";
    taskContext: string;
    attemptLabel?: string;
  }) =>
    input.moduleInput.runPersonaInteractionStage({
      personaId: input.moduleInput.task.personaId,
      modelId: modelSelection.modelId,
      taskType: input.taskType,
      stagePurpose: stageInput.stagePurpose,
      taskContext: stageInput.taskContext,
      boardContextText: promptContext.boardContextText,
      targetContextText: promptContext.targetContextText,
      debug: input.moduleInput.debug,
      attemptLabel: stageInput.attemptLabel,
    });
  let lastError: Error | null = null;

  for (const regenerateAttempt of [false, true] as const) {
    attempt.main += 1;
    if (regenerateAttempt) {
      attempt.regenerate += 1;
    }

    try {
      let preview = await runStage({
        stagePurpose: "main",
        taskContext: regenerateAttempt
          ? buildFreshRegenerateTaskContext(promptContext.taskContext, input.flowKind)
          : promptContext.taskContext,
        attemptLabel: `${input.flowKind}.main`,
      });
      collectDebugRecords(preview);
      let parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      if ((!parsed.output?.markdown?.trim() || parsed.error) && attempt.schemaRepair < 1) {
        attempt.schemaRepair += 1;
        preview = await runStage({
          stagePurpose: "schema_repair",
          taskContext: buildSchemaRepairTaskContext({
            baseTaskContext: promptContext.taskContext,
            flowKind: input.flowKind,
            previousOutput: preview.rawResponse ?? preview.markdown,
            error: parsed.error,
          }),
          attemptLabel: `${input.flowKind}.schema_repair`,
        });
        collectDebugRecords(preview);
        parsed = parseMarkdownActionOutput(preview.rawResponse ?? preview.markdown);
      }
      const parsedOutput = requireMarkdownOutput(parsed, input.flowKind);

      const audited = await runAuditRepairLoop({
        flowKind: input.flowKind,
        parsed,
        promptContext,
        moduleInput: input.moduleInput,
        modelId: modelSelection.modelId,
        attempt,
        stageDebugRecords,
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
                  audited.parsed.output?.markdown ?? parsedOutput.markdown,
                  audited.parsed.output?.imageRequest ?? parsedOutput.imageRequest,
                ) as { comment: CommentOutput },
                diagnostics,
              }
            : {
                flowKind: "reply",
                parsed: mapParsedOutput(
                  "reply",
                  audited.parsed.output?.markdown ?? parsedOutput.markdown,
                  audited.parsed.output?.imageRequest ?? parsedOutput.imageRequest,
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
  });
}
