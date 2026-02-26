import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";

export const GET = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") ?? "30");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;

  const store = new SupabaseRuntimeObservabilityStore();
  const items = await store.listRecentTasks(limit);
  return http.ok({
    items,
    limit,
    updatedAt: new Date().toISOString(),
  });
});
