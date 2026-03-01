import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    personaId?: string;
    modelId?: string;
    taskType?: "post" | "comment";
    taskContext?: string;
    soulOverride?: Record<string, unknown>;
    longMemoryOverride?: string;
  };

  if (!body.personaId?.trim() || !body.modelId?.trim()) {
    return http.badRequest("personaId and modelId are required");
  }

  if (body.taskType !== "post" && body.taskType !== "comment") {
    return http.badRequest("taskType must be post or comment");
  }

  const preview = await new AdminAiControlPlaneStore().previewPersonaInteraction({
    personaId: body.personaId.trim(),
    modelId: body.modelId.trim(),
    taskType: body.taskType,
    taskContext: body.taskContext ?? "",
    soulOverride: body.soulOverride,
    longMemoryOverride: body.longMemoryOverride,
  });

  return http.ok({ preview });
});
