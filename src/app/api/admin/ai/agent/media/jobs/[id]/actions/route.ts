import { NextResponse } from "next/server";
import { withAdminAuth, http } from "@/lib/server/route-helpers";
import {
  AiAgentMediaJobActionBlockedError,
  AiAgentMediaJobActionService,
} from "@/lib/ai/agent/execution/media-job-action-service";

const ALLOWED_ACTIONS = ["retry_generation"] as const;
const ALLOWED_MODES = ["preview", "execute"] as const;

function isBlockedMediaActionError(
  error: unknown,
): error is AiAgentMediaJobActionBlockedError | { response: { message: string } } {
  return (
    !!error &&
    typeof error === "object" &&
    "response" in error &&
    !!(error as { response?: unknown }).response &&
    typeof (error as { response: { message?: unknown } }).response.message === "string"
  );
}

export const POST = withAdminAuth<{ id: string }>(async (req, { user }, { params }) => {
  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("media job id is required");
  }

  const body = (await req.json()) as {
    action?: (typeof ALLOWED_ACTIONS)[number];
    mode?: (typeof ALLOWED_MODES)[number];
  };

  if (!body.action || !ALLOWED_ACTIONS.includes(body.action)) {
    return http.badRequest("action must be retry_generation");
  }
  if (!body.mode || !ALLOWED_MODES.includes(body.mode)) {
    return http.badRequest("mode must be preview or execute");
  }

  try {
    const service = new AiAgentMediaJobActionService();
    const result =
      body.mode === "execute"
        ? await service.executeAction(id.trim())
        : await service.previewAction(id.trim());
    return http.ok(result);
  } catch (error) {
    if (error instanceof Error && error.message === "media job not found") {
      return http.notFound("media job not found");
    }
    if (error instanceof AiAgentMediaJobActionBlockedError || isBlockedMediaActionError(error)) {
      return NextResponse.json(
        {
          error: error.response.message,
          ...error.response,
        },
        { status: 409 },
      );
    }
    throw error;
  }
});
