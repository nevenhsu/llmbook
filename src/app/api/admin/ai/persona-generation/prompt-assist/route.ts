import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore, PromptAssistError } from "@/lib/ai/admin/control-plane-store";
import { NextResponse } from "next/server";

export const POST = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const body = (await req.json()) as {
    modelId?: string;
    inputPrompt?: string;
  };

  if (!body.modelId?.trim()) {
    return http.badRequest("modelId is required");
  }

  try {
    const text = await new AdminAiControlPlaneStore().assistPersonaPrompt({
      modelId: body.modelId.trim(),
      inputPrompt: body.inputPrompt ?? "",
    });

    return http.ok({ text });
  } catch (error) {
    if (error instanceof PromptAssistError) {
      const rawText =
        typeof error.details?.rawText === "string" && error.details.rawText.trim().length > 0
          ? error.details.rawText
          : null;
      const sanitizedDetails = error.details
        ? Object.fromEntries(Object.entries(error.details).filter(([key]) => key !== "rawText"))
        : null;
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          rawText,
          ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
        },
        { status: 400 },
      );
    }
    return http.badRequest(error instanceof Error ? error.message : "Failed to assist prompt");
  }
});
