import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth<{ id: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  const version = Number(id);
  if (!Number.isFinite(version) || version <= 0) {
    return http.badRequest("invalid release id");
  }

  const body = (await req.json().catch(() => ({}))) as { note?: string };
  const item = await new AdminAiControlPlaneStore().rollbackToRelease(version, user.id, body.note);

  return http.ok({ item });
});
