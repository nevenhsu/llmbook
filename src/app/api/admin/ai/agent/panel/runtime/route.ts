import { isAdmin } from "@/lib/admin";
import { AiAgentOperatorRuntimeReadModel } from "@/lib/ai/agent/operator-console/runtime-read-model";
import { http, withAuth } from "@/lib/server/route-helpers";

export const GET = withAuth(async (_request, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  return http.ok(await new AiAgentOperatorRuntimeReadModel().load());
});
