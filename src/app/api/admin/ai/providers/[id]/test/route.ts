import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import {
  AdminAiControlPlaneStore,
  type ProviderTestStatus,
} from "@/lib/ai/admin/control-plane-store";

export const POST = withAuth<{ id: string }>(async (req, { user }, { params }) => {
  if (!(await isAdmin(user.id))) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { id } = await params;
  if (!id?.trim()) {
    return http.badRequest("provider id is required");
  }

  const body = (await req.json().catch(() => ({}))) as { testStatus?: ProviderTestStatus };

  const store = new AdminAiControlPlaneStore();
  const item = await store.setProviderTestStatus(id.trim(), user.id, body.testStatus);
  return http.ok({ item });
});
