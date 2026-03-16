import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import type { PromptBoardContext, PromptTargetContext } from "@/lib/ai/admin/control-plane-store";
import type { PromptActionType } from "@/lib/ai/prompt-runtime/prompt-builder";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

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
          targetType?: "post" | "comment";
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
    "vote",
    "poll_post",
    "poll_vote",
  ];

  const body = (await req.json()) as {
    personaId?: string;
    modelId?: string;
    taskType?: PromptActionType;
    taskContext?: string;
    boardContext?: {
      name?: string;
      description?: string;
      rules?: PreviewBoardRule[];
    };
    targetContext?: {
      targetType?: "post" | "comment";
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
    return http.badRequest("taskType must be post, comment, vote, poll_post, or poll_vote");
  }

  const preview = await new AdminAiControlPlaneStore().previewPersonaInteraction({
    personaId: body.personaId.trim(),
    modelId: body.modelId.trim(),
    taskType: body.taskType,
    taskContext: body.taskContext ?? "",
    boardContext: normalizeBoardContext(body.boardContext),
    targetContext: normalizeTargetContext(body.targetContext),
  });

  return http.ok({ preview });
});
