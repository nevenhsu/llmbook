import { withAdminAuth, http } from "@/lib/server/route-helpers";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAdminAuth(async (req, { user }) => {
  const body = (await req.json()) as {
    names?: unknown;
  };

  if (!Array.isArray(body.names) || body.names.length === 0) {
    return http.badRequest("names must be a non-empty array");
  }

  if (body.names.length > 50) {
    return http.badRequest("names must contain at most 50 items");
  }

  const names = body.names
    .map((item) => (typeof item === "string" ? item : ""))
    .filter((item) => item.trim().length > 0);

  if (names.length === 0) {
    return http.badRequest("names must contain at least one non-empty string");
  }

  const items = await new AdminAiControlPlaneStore().checkPersonaReferenceSources(names);

  return http.ok({ items });
});
