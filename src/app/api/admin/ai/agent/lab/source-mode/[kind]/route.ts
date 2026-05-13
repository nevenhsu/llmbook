import { AiAgentAdminLabSourceService } from "@/lib/ai/agent/intake/admin-lab-source-service";
import { withAdminAuth, http, parseJsonBody } from "@/lib/server/route-helpers";

type Body = {
  batchSize?: number;
  groupIndex?: number;
  score?: boolean;
};

export const POST = withAdminAuth<{ kind: string }>(async (req, { user }, { params }) => {
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
