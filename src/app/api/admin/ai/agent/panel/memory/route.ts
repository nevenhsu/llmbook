import { isAdmin } from "@/lib/admin";
import { AiAgentMemoryTableReadModel } from "@/lib/ai/agent/operator-console/memory-table-read-model";
import { http, withAuth } from "@/lib/server/route-helpers";
import { parsePositiveInt } from "@/app/api/admin/ai/agent/panel/_shared";

export const GET = withAuth(async (request, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
  if (page === null || pageSize === null) {
    return http.badRequest("Invalid pagination params");
  }

  return http.ok(await new AiAgentMemoryTableReadModel().list({ page, pageSize }));
});
