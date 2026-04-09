import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import {
  AiAgentJobsRuntimeControlService,
  type AiAgentJobsRuntimeAction,
} from "@/lib/ai/agent/operator-console/jobs-runtime-control";
import { http, withAuth } from "@/lib/server/route-helpers";

function parseAction(value: string): AiAgentJobsRuntimeAction | null {
  return value === "pause" || value === "start" ? value : null;
}

export const POST = withAuth<{ action: string }>(async (_request, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { action: rawAction } = await params;
  const action = parseAction(rawAction);
  if (!action) {
    return http.notFound("invalid jobs runtime action");
  }

  const result = await new AiAgentJobsRuntimeControlService().execute(action);
  return NextResponse.json(result, {
    status: result.mode === "executed" ? 200 : 409,
  });
});
