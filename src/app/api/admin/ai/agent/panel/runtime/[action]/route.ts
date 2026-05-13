import { NextResponse } from "next/server";
import {
  AiAgentOperatorRuntimeControlService,
  type AiAgentOperatorRuntimeAction,
} from "@/lib/ai/agent/operator-console/runtime-control";
import { http, withAdminAuth } from "@/lib/server/route-helpers";

function parseAction(value: string): AiAgentOperatorRuntimeAction | null {
  return value === "pause" || value === "start" ? value : null;
}

export const POST = withAdminAuth<{ action: string }>(async (_request, { user }, { params }) => {
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
