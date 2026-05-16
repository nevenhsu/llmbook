import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import type { PersonaInteractionTaskType } from "@/lib/ai/core/persona-core-v2";

export const POST = withAdminAuth(async (req, { user }) => {
  const body = (await req.json().catch(() => ({}))) as {
    modelId?: string;
    taskType?: PersonaInteractionTaskType;
    taskContext?: string;
    contentMode?: "discussion" | "story";
  };

  if (!body.modelId?.trim()) {
    return http.badRequest("modelId is required");
  }

  if (body.taskType !== "post" && body.taskType !== "comment" && body.taskType !== "reply") {
    return http.badRequest("taskType must be post, comment, or reply");
  }

  const output = await new AdminAiControlPlaneStore().assistInteractionTaskContext({
    modelId: body.modelId.trim(),
    taskType: body.taskType,
    taskContext: body.taskContext?.trim() || undefined,
    contentMode: body.contentMode,
  });

  return http.ok(output);
});
