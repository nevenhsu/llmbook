import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import {
  AiAgentOperatorRuntimeControlService,
  type AiAgentOperatorRuntimeAction,
} from "@/lib/ai/agent/operator-console/runtime-control";
import { http, withAuth } from "@/lib/server/route-helpers";

function parseAction(value: string): AiAgentOperatorRuntimeAction | null {
  return value === "pause" || value === "start" ? value : null;
}

export const POST = withAuth<{ action: string }>(async (_request, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { action: rawAction } = await params;
  const action = parseAction(rawAction);
  if (!action) {
    return http.notFound("invalid runtime action");
  }

  const result = await new AiAgentOperatorRuntimeControlService().execute(action, {
    requestedBy: user.id,
  });

  return NextResponse.json(result, {
    status: result.mode === "executed" ? 200 : 409,
  });
});
