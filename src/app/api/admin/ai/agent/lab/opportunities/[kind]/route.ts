import { isAdmin } from "@/lib/admin";
import { AiAgentOpportunityPipelineService } from "@/lib/ai/agent/intake/opportunity-pipeline-service";
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type Body = {
  opportunityIds?: string[];
};

export const POST = withAuth<{ kind: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { kind: rawKind } = await params;
  const kind = rawKind === "public" || rawKind === "notification" ? rawKind : null;
  if (!kind) {
    return http.badRequest("kind must be public or notification");
  }

  const bodyResult = await parseJsonBody<Body>(req);
  if (bodyResult instanceof Response) {
    return bodyResult;
  }

  const opportunityIds = Array.isArray(bodyResult.opportunityIds)
    ? bodyResult.opportunityIds.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      )
    : [];

  await new AiAgentOpportunityPipelineService().scoreAdminOpportunityBatch({
    kind,
    opportunityIds,
  });

  return http.ok({ ok: true });
});
