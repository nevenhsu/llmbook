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
