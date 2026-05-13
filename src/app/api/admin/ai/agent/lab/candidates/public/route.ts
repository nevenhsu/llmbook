import { AiAgentOpportunityPipelineService } from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import { withAdminAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type Body = {
  opportunityIds?: string[];
  groupIndex?: number;
  batchSize?: number;
};

export const POST = withAdminAuth(async (req, { user }) => {
  const bodyResult = await parseJsonBody<Body>(req);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const opportunityIds = Array.isArray(bodyResult.opportunityIds)
    ? bodyResult.opportunityIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];
  if (opportunityIds.length > 10) {
    return http.badRequest("opportunityIds must contain at most 10 rows");
  }
  const groupIndex = typeof bodyResult.groupIndex === "number" ? bodyResult.groupIndex : 0;
  const batchSize = typeof bodyResult.batchSize === "number" ? bodyResult.batchSize : 10;

  const result = await new AiAgentOpportunityPipelineService().executeAdminPublicCandidateBatch({
    opportunityIds,
    groupIndex,
    batchSize,
  });

  return http.ok(result);
});
