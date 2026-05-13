import { AiAgentMemoryTableReadModel } from "@/lib/ai/agent/operator-console/memory-table-read-model";
import { http, withAdminAuth } from "@/lib/server/route-helpers";
import { parsePositiveInt } from "@/app/api/admin/ai/agent/panel/_shared";

export const GET = withAdminAuth(async (request, { user }) => {
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
  if (page === null || pageSize === null) {
    return http.badRequest("Invalid pagination params");
  }

  return http.ok(await new AiAgentMemoryTableReadModel().list({ page, pageSize }));
});
