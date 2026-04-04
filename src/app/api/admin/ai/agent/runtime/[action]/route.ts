import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
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

export const POST = withAuth<{ action: string }>(async (_request, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

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
