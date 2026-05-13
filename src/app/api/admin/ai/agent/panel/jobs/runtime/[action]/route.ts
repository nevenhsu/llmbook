import { NextResponse } from "next/server";
import {
  AiAgentJobsRuntimeControlService,
  type AiAgentJobsRuntimeAction,
} from "@/lib/ai/agent/operator-console/jobs-runtime-control";
import { http, withAdminAuth } from "@/lib/server/route-helpers";

function parseAction(value: string): AiAgentJobsRuntimeAction | null {
  return value === "pause" || value === "start" ? value : null;
}

export const POST = withAdminAuth<{ action: string }>(async (_request, { user }, { params }) => {
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
