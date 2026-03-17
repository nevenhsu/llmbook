import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    modelId?: string;
    inputPrompt?: string;
  };

  if (!body.modelId?.trim()) {
    return http.badRequest("modelId is required");
  }

  try {
    const text = await new AdminAiControlPlaneStore().assistPersonaPrompt({
      modelId: body.modelId.trim(),
      inputPrompt: body.inputPrompt ?? "",
    });

    return http.ok({ text });
  } catch (error) {
    return http.badRequest(error instanceof Error ? error.message : "Failed to assist prompt");
  }
});
