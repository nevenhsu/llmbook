import { isAdmin } from "@/lib/admin";
import { AiAgentTaskTableReadModel } from "@/lib/ai/agent/operator-console/task-table-read-model";
import { http, withAuth } from "@/lib/server/route-helpers";
import { parsePositiveInt } from "@/app/api/admin/ai/agent/panel/_shared";

function parseKind(value: string): "public" | "notification" | null {
  return value === "public" || value === "notification" ? value : null;
}

export const GET = withAuth<{ kind: string }>(async (request, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { kind: rawKind } = await params;
  const kind = parseKind(rawKind);
  if (!kind) {
    return http.notFound("invalid task kind");
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
  if (page === null || pageSize === null) {
    return http.badRequest("Invalid pagination params");
  }

  return http.ok(await new AiAgentTaskTableReadModel().list({ kind, page, pageSize }));
});
