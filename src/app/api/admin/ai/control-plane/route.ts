import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { AdminAiControlPlaneStore } from "@/lib/ai/admin/control-plane-store";

export const GET = withAuth(async (req, { user }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const releaseLimitRaw = Number(searchParams.get("releaseLimit") ?? "20");
  const releaseLimit = Number.isFinite(releaseLimitRaw)
    ? Math.max(1, Math.min(50, releaseLimitRaw))
    : 20;

  const store = new AdminAiControlPlaneStore();
  const snapshot = await store.getAdminControlPlaneSnapshot({
    releaseLimit,
  });

  return http.ok(snapshot);
});
