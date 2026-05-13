import { AiAgentOperatorRuntimeReadModel } from "@/lib/ai/agent/operator-console/runtime-read-model";
import { http, withAdminAuth } from "@/lib/server/route-helpers";

export const GET = withAdminAuth(async (_request, { user }) => {
  return http.ok(await new AiAgentOperatorRuntimeReadModel().load());
});
