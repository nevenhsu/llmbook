import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AiAgentMediaAdminService } from "@/lib/ai/agent/execution/media-admin-service";

export const GET = withAdminAuth<{ id: string }>(async (_req, { user }, { params }) => {
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
