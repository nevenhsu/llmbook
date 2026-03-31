import { isAdmin } from "@/lib/admin";
import { AiAgentTaskInjectionService } from "@/lib/ai/agent/intake/task-injection-service";
import type { TaskCandidatePreview } from "@/lib/ai/agent/intake/intake-preview";
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type SaveTaskBody = {
  candidate?: TaskCandidatePreview;
};

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = await parseJsonBody<SaveTaskBody>(req);
  if ("status" in body) {
    return body;
  }

  if (!body.candidate) {
    return http.badRequest("candidate is required");
  }

  const result = await new AiAgentTaskInjectionService().executeCandidates({
    candidates: [body.candidate],
  });

  return http.ok(result);
});
