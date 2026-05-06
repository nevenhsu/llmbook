import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore, PromptAssistError } from "@/lib/ai/admin/control-plane-store";
import { NextResponse } from "next/server";

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
  const inputPrompt = typeof parsed.inputPrompt === "string" ? parsed.inputPrompt : "";

  if (!modelId) {
    return http.badRequest("modelId is required and must be a non-empty string");
  }

  try {
    const text = await new AdminAiControlPlaneStore().assistPersonaPrompt({
      modelId,
      inputPrompt,
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
