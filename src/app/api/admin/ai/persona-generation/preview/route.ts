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

  const body = (await req.json()) as {
    modelId?: string;
    extraPrompt?: string;
  };

  if (!body.modelId?.trim()) {
    return http.badRequest("modelId is required");
  }

  let preview;
  try {
    preview = await new AdminAiControlPlaneStore().previewPersonaGeneration({
      modelId: body.modelId.trim(),
      extraPrompt: body.extraPrompt ?? "",
    });
  } catch (error) {
    if (error instanceof PersonaGenerationQualityError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "persona_generation_stage_quality_failed",
          stageName: error.stageName,
          issues: error.issues,
          result: error.rawOutput,
          ...(error.details ? { details: error.details } : {}),
        },
        { status: 422 },
      );
    }
    if (error instanceof PersonaGenerationParseError) {
      return NextResponse.json(
        {
          error: error.message,
          ...(error.stageName ? { stageName: error.stageName } : {}),
          result: error.rawOutput,
          ...(error.details ? { details: error.details } : {}),
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
