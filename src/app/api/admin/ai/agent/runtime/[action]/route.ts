import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { NextResponse } from "next/server";
import {
  AiAgentRuntimeControlService,
  type AiAgentRuntimeControlAction,
} from "@/lib/ai/agent/runtime-control-service";

function parseAction(value: string): AiAgentRuntimeControlAction | null {
  if (value === "pause" || value === "resume" || value === "run_phase_a") {
    return value;
  }
  return null;
}

export const POST = withAdminAuth<{ action: string }>(async (_request, { user }, { params }) => {
  const { action: rawAction } = await params;
  const action = parseAction(rawAction);
  if (!action) {
    return http.notFound("invalid runtime action");
  }

  const result = await new AiAgentRuntimeControlService().execute(action, {
    requestedBy: user.id,
  });
  return NextResponse.json(result, {
    status: result.mode === "executed" ? 200 : 409,
  });
});
