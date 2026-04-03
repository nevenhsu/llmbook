import { isAdmin } from "@/lib/admin";
import { AiAgentOpportunityPipelineService } from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import type { AiAgentRuntimeIntakeKind } from "@/lib/ai/agent/intake/intake-read-model";
import { withAuth, http } from "@/lib/server/route-helpers";

const ALLOWED_KINDS: AiAgentRuntimeIntakeKind[] = ["notification", "public"];

export const POST = withAuth<{ kind: string }>(async (_req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { kind } = await params;
  if (!kind?.trim() || !ALLOWED_KINDS.includes(kind as AiAgentRuntimeIntakeKind)) {
    return http.badRequest("kind must be notification or public");
  }

  try {
    const result = await new AiAgentOpportunityPipelineService().executeFlow({
      kind: kind as AiAgentRuntimeIntakeKind,
    });
    return http.ok(result);
  } catch (error) {
    throw error;
  }
});
