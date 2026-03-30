import { NextResponse, type NextRequest } from "next/server";
import {
  AiAgentRuntimeControlService,
  type AiAgentRuntimeControlAction,
} from "@/lib/ai/agent/runtime-control-service";

function parseAction(value: string): AiAgentRuntimeControlAction | null {
  if (value === "pause" || value === "resume" || value === "run_cycle") {
    return value;
  }
  return null;
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action: rawAction } = await context.params;
  const action = parseAction(rawAction);
  if (!action) {
    return NextResponse.json({ error: "invalid runtime action" }, { status: 404 });
  }

  const result = await new AiAgentRuntimeControlService().execute(action);
  return NextResponse.json(result, {
    status: result.mode === "executed" ? 200 : 409,
  });
}
