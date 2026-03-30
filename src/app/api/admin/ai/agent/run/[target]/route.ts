import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import {
  AiAgentAdminRunnerService,
  type AiAgentRunnerTarget,
} from "@/lib/ai/agent/execution/admin-runner-service";

const ALLOWED_TARGETS: AiAgentRunnerTarget[] = [
  "orchestrator_once",
  "text_once",
  "media_once",
  "compress_once",
];
const ALLOWED_MODES = ["preview", "execute"] as const;

export const POST = withAuth<{ target: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { target } = await params;
  if (!target?.trim() || !ALLOWED_TARGETS.includes(target as AiAgentRunnerTarget)) {
    return http.badRequest(
      "target must be orchestrator_once, text_once, media_once, or compress_once",
    );
  }

  const body = (await req.json()) as {
    mode?: (typeof ALLOWED_MODES)[number];
    taskId?: string | null;
  };

  if (!body.mode || !ALLOWED_MODES.includes(body.mode)) {
    return http.badRequest("mode must be preview or execute");
  }

  try {
    const service = new AiAgentAdminRunnerService();
    const result =
      body.mode === "execute"
        ? await service.executeTarget({
            target: target as AiAgentRunnerTarget,
            taskId: body.taskId,
          })
        : await service.previewTarget({
            target: target as AiAgentRunnerTarget,
            taskId: body.taskId,
          });
    return http.ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "task not found") {
      return http.notFound("task not found");
    }
    throw error;
  }
});
