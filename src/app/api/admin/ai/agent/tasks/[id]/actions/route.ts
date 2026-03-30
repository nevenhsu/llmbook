import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import type { AiAgentQueueActionName } from "@/lib/ai/agent/tasks/queue-action-preview";
import { AiAgentQueueActionService } from "@/lib/ai/agent/tasks/queue-action-service";

const ALLOWED_ACTIONS: AiAgentQueueActionName[] = ["retry_task", "requeue_task", "mark_dead"];
const ALLOWED_MODES = ["preview", "execute"] as const;

export const POST = withAuth<{ id: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("task id is required");
  }

  const body = (await req.json()) as {
    action?: AiAgentQueueActionName;
    mode?: (typeof ALLOWED_MODES)[number];
  };

  if (!body.action || !ALLOWED_ACTIONS.includes(body.action)) {
    return http.badRequest("action must be retry_task, requeue_task, or mark_dead");
  }
  if (!body.mode || !ALLOWED_MODES.includes(body.mode)) {
    return http.badRequest("mode must be preview or execute");
  }

  try {
    const service = new AiAgentQueueActionService();
    const result =
      body.mode === "execute"
        ? await service.executeAction({
            taskId: id.trim(),
            action: body.action,
          })
        : await service.previewAction({
            taskId: id.trim(),
            action: body.action,
          });
    return http.ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "task not found") {
      return http.notFound("task not found");
    }
    if (error instanceof Error && error.message.startsWith("queue action blocked: ")) {
      return http.conflict(error.message.replace("queue action blocked: ", ""));
    }
    throw error;
  }
});
