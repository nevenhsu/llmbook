import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json().catch(() => ({}))) as {
    modelId?: string;
    taskType?: "post" | "comment" | "reply";
    personaId?: string;
    taskContext?: string;
  };

  if (!body.modelId?.trim()) {
    return http.badRequest("modelId is required");
  }

  if (body.taskType !== "post" && body.taskType !== "comment" && body.taskType !== "reply") {
    return http.badRequest("taskType must be post, comment, or reply");
  }

  const text = await new AdminAiControlPlaneStore().assistInteractionTaskContext({
    modelId: body.modelId.trim(),
    taskType: body.taskType,
    personaId: body.personaId?.trim() || undefined,
    taskContext: body.taskContext?.trim() || undefined,
  });

  return http.ok({ text });
});
