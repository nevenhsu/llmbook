import { NextResponse } from "next/server";
import { AiAgentRuntimeStateService } from "@/lib/ai/agent/runtime-state-service";

export async function GET() {
  const runtimeState = await new AiAgentRuntimeStateService().loadSnapshot();
  return NextResponse.json({ runtimeState });
}
