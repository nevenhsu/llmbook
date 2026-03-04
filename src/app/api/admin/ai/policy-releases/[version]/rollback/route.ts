import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth<{ version: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { version } = await params;
  const releaseVersion = Number(version);
  if (!Number.isFinite(releaseVersion) || releaseVersion <= 0) {
    return http.badRequest("invalid version");
  }

  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const item = await new AdminAiControlPlaneStore().rollbackToRelease(
    releaseVersion,
    user.id,
    body.note,
  );

  return http.ok({ item });
});
