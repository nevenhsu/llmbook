import { NextResponse } from "next/server";
import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import {
  AdminAiControlPlaneStore,
  PersonaGenerationParseError,
  PersonaGenerationQualityError,
} from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return http.badRequest("Request body must be valid JSON");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return http.badRequest("Request body must be a JSON object");
  }

  const parsed = body as Record<string, unknown>;
  const modelId = typeof parsed.modelId === "string" ? parsed.modelId.trim() : "";
  const extraPrompt = typeof parsed.extraPrompt === "string" ? parsed.extraPrompt : "";
  const debug = parsed.debug === true;

  if (!modelId) {
    return http.badRequest("modelId is required and must be a non-empty string");
  }

  let preview;
  try {
    preview = await new AdminAiControlPlaneStore().previewPersonaGeneration({
      modelId,
      extraPrompt,
      debug,
    });
  } catch (error) {
    if (error instanceof PersonaGenerationQualityError) {
      const debugRecords =
        debug &&
        error.details &&
        typeof error.details === "object" &&
        "stageDebugRecords" in error.details
          ? (error.details as { stageDebugRecords?: unknown }).stageDebugRecords
          : undefined;
      return NextResponse.json(
        {
          error: error.message,
          code: "persona_generation_stage_quality_failed",
          stageName: error.stageName,
          issues: error.issues,
          result: error.rawOutput,
          ...(error.details ? { details: error.details } : {}),
          ...(debugRecords ? { stageDebugRecords: debugRecords } : {}),
        },
        { status: 422 },
      );
    }
    if (error instanceof PersonaGenerationParseError) {
      const debugRecords =
        debug &&
        error.details &&
        typeof error.details === "object" &&
        "stageDebugRecords" in error.details
          ? (error.details as { stageDebugRecords?: unknown }).stageDebugRecords
          : undefined;
      return NextResponse.json(
        {
          error: error.message,
          ...(error.stageName ? { stageName: error.stageName } : {}),
          result: error.rawOutput,
          ...(error.details ? { details: error.details } : {}),
          ...(debugRecords ? { stageDebugRecords: debugRecords } : {}),
        },
        { status: 422 },
      );
    }
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return NextResponse.json(
        {
          error: error.message,
          ...("stageName" in error && typeof error.stageName === "string"
            ? { stageName: error.stageName }
            : {}),
          result:
            "result" in error && typeof error.result === "string"
              ? error.result
              : "rawOutput" in error && typeof error.rawOutput === "string"
                ? error.rawOutput
                : null,
          ...("details" in error && error.details && typeof error.details === "object"
            ? { details: error.details }
            : {}),
        },
        { status: 500 },
      );
    }
    throw error;
  }

  return http.ok({ preview });
});
