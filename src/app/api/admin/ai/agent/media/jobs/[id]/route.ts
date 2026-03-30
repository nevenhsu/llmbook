import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AiAgentMediaAdminService } from "@/lib/ai/agent/execution/media-admin-service";

export const GET = withAuth<{ id: string }>(async (_req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("media job id is required");
  }

  try {
    const response = await new AiAgentMediaAdminService().getJobDetail(id.trim());
    return http.ok(response);
  } catch (error) {
    if (error instanceof Error && error.message === "media job not found") {
      return http.notFound("media job not found");
    }
    throw error;
  }
});
