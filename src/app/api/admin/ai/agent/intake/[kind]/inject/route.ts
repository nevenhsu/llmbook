import { AiAgentOpportunityPipelineService } from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import type { AiAgentRuntimeIntakeKind } from "@/lib/ai/agent/intake/intake-read-model";
import { withAdminAuth, http } from "@/lib/server/route-helpers";

const ALLOWED_KINDS: AiAgentRuntimeIntakeKind[] = ["notification", "public"];

export const POST = withAdminAuth<{ kind: string }>(async (_req, { user }, { params }) => {
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
