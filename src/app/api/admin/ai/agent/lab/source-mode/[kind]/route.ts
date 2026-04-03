import { isAdmin } from "@/lib/admin";
import { AiAgentAdminLabSourceService } from "@/lib/ai/agent/intake/admin-lab-source-service";
import { withAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type Body = {
  batchSize?: number;
  groupIndex?: number;
  score?: boolean;
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
  const snapshot = await new AiAgentAdminLabSourceService().loadSnapshot({
    kind,
    batchSize: typeof bodyResult.batchSize === "number" ? bodyResult.batchSize : undefined,
    groupIndex: typeof bodyResult.groupIndex === "number" ? bodyResult.groupIndex : undefined,
    score: bodyResult.score,
  });

  return http.ok({
    snapshot,
  });
});
