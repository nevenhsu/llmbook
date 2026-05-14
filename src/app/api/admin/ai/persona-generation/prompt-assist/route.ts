import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";
import { NextResponse } from "next/server";

export const POST = withAdminAuth(async (req, { user }) => {
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

  const result = await new AdminAiControlPlaneStore().assistPersonaPrompt({
    modelId,
    inputPrompt,
  });

  if ("error" in result) {
    return NextResponse.json(
      {
        error: result.error,
        rawText: result.rawText,
        debugRecords: result.debugRecords,
      },
      { status: 400 },
    );
  }

  return http.ok({
    text: result.text,
    referenceNames: result.referenceNames,
    debugRecords: result.debugRecords,
  });
});
