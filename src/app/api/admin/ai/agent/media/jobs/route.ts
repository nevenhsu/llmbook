import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AiAgentMediaAdminService } from "@/lib/ai/agent/execution/media-admin-service";

export const GET = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const statusParam = url.searchParams.get("status");
  const queryParam = url.searchParams.get("query");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 12;
  if (Number.isNaN(limit) || limit < 1) {
    return http.badRequest("limit must be a positive integer");
  }

  if (
    statusParam &&
    statusParam !== "all" &&
    statusParam !== "PENDING_GENERATION" &&
    statusParam !== "RUNNING" &&
    statusParam !== "DONE" &&
    statusParam !== "FAILED"
  ) {
    return http.badRequest("status must be all, PENDING_GENERATION, RUNNING, DONE, or FAILED");
  }

  const response = await new AiAgentMediaAdminService().listRecentJobs({
    limit,
    status:
      (statusParam as "all" | "PENDING_GENERATION" | "RUNNING" | "DONE" | "FAILED" | null) ?? "all",
    query: queryParam?.trim() ? queryParam.trim() : undefined,
  });
  return http.ok(response);
});
