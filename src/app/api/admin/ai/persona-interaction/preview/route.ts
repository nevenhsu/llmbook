import { NextResponse } from "next/server";
import { withAdminAuth, http } from "@/lib/server/route-helpers";
import type { PromptBoardContext, PromptTargetContext } from "@/lib/ai/admin/control-plane-store";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import {
  type InteractionContextAssistOutput,
  serializeAssistOutput,
} from "@/lib/ai/admin/interaction-context-assist-schema";
import { PersonaOutputValidationError } from "@/lib/ai/prompt-runtime/persona-audit-shared";

export const POST = withAdminAuth(async (req, { user }) => {
  type PreviewBoardRule = {
    title?: string;
    description?: string;
  };

  const normalizeBoardContext = (
    boardContext:
      | {
          name?: string;
          description?: string;
          rules?: PreviewBoardRule[];
        }
      | undefined,
  ): PromptBoardContext | undefined => {
    if (!boardContext) {
      return undefined;
    }

    return {
      name: boardContext.name,
      description: boardContext.description,
      rules: Array.isArray(boardContext.rules)
        ? boardContext.rules.map((rule) => ({
            title: rule.title ?? "",
            description: rule.description,
          }))
        : undefined,
    };
  };

  const normalizeTargetContext = (
    targetContext:
      | {
          targetType?: "post" | "comment" | "reply";
          targetId?: string;
          targetAuthor?: string;
          targetContent?: string;
          threadSummary?: string;
          pollPostId?: string;
          pollQuestion?: string;
          pollOptions?: Array<{ id?: string; label?: string }>;
        }
      | undefined,
  ): PromptTargetContext | undefined => {
    if (!targetContext) {
      return undefined;
    }

    return {
      targetType: targetContext.targetType,
      targetId: targetContext.targetId,
      targetAuthor: targetContext.targetAuthor,
      targetContent: targetContext.targetContent,
      threadSummary: targetContext.threadSummary,
      pollPostId: targetContext.pollPostId,
      pollQuestion: targetContext.pollQuestion,
      pollOptions: Array.isArray(targetContext.pollOptions)
        ? targetContext.pollOptions.map((option) => ({
            id: option.id ?? "",
            label: option.label ?? "",
          }))
        : undefined,
    };
  };

  const allowedTaskTypes: PromptActionType[] = [
    "post",
    "comment",
    "reply",
    "vote",
    "poll_post",
    "poll_vote",
  ];

  const body = (await req.json()) as {
    personaId?: string;
    modelId?: string;
    taskType?: PromptActionType;
    taskContext?: string;
    structuredContext?: InteractionContextAssistOutput;
    contentMode?: "discussion" | "story";
    boardContext?: {
      name?: string;
      description?: string;
      rules?: PreviewBoardRule[];
    };
    targetContext?: {
      targetType?: "post" | "comment" | "reply";
      targetId?: string;
      targetAuthor?: string;
      targetContent?: string;
      threadSummary?: string;
      pollPostId?: string;
      pollQuestion?: string;
      pollOptions?: Array<{ id?: string; label?: string }>;
    };
  };

  if (!body.personaId?.trim() || !body.modelId?.trim()) {
    return http.badRequest("personaId and modelId are required");
  }

  if (!body.taskType || !allowedTaskTypes.includes(body.taskType)) {
    return http.badRequest("taskType must be post, comment, reply, vote, poll_post, or poll_vote");
  }

  const isUserFacing =
    body.taskType === "post" || body.taskType === "comment" || body.taskType === "reply";

  const serializedStructured = body.structuredContext
    ? serializeAssistOutput(body.structuredContext)
    : undefined;

  const resolvedTargetContextText = isUserFacing
    ? (serializedStructured ?? (body.taskContext?.trim() || undefined))
    : undefined;

  const resolvedTaskContext = isUserFacing ? "" : (serializedStructured ?? body.taskContext ?? "");

  let preview;
  try {
    preview = await new AdminAiControlPlaneStore().previewPersonaInteraction({
      personaId: body.personaId.trim(),
      modelId: body.modelId.trim(),
      taskType: body.taskType,
      taskContext: resolvedTaskContext,
      contentMode: body.contentMode,
      boardContext: normalizeBoardContext(body.boardContext),
      targetContext: normalizeTargetContext(body.targetContext),
      targetContextText: resolvedTargetContextText,
    });
  } catch (error) {
    if (error instanceof PersonaOutputValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          issues: error.issues,
          repairGuidance: error.repairGuidance,
          severity: error.severity,
          confidence: error.confidence,
          missingSignals: error.missingSignals,
          rawOutput: error.rawOutput,
        },
        { status: 422 },
      );
    }
    throw error;
  }

  return http.ok({ preview });
});
