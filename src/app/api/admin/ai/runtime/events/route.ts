import { withAuth, http } from "@/lib/server/route-helpers";
import { isAdmin } from "@/lib/admin";
import { SupabaseRuntimeObservabilityStore } from "@/lib/ai/observability/runtime-observability-store";

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const GET = withAuth(async (req, { user }) => {
  const admin = await isAdmin(user.id);
  if (!admin) {
    return http.forbidden("Forbidden - Admin access required");
  }

  const { searchParams } = new URL(req.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"));
  const cursor = parseDate(searchParams.get("cursor"));
  if ((searchParams.get("from") && !from) || (searchParams.get("to") && !to)) {
    return http.badRequest("Invalid time range");
  }
  if (searchParams.get("cursor") && !cursor) {
    return http.badRequest("Invalid cursor");
  }

  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;

  const store = new SupabaseRuntimeObservabilityStore();
  const result = await store.listRuntimeEvents({
    layer: searchParams.get("layer")?.trim() || undefined,
    reasonCode: searchParams.get("reasonCode")?.trim() || undefined,
    entityId: searchParams.get("entityId")?.trim() || undefined,
    from: from ?? undefined,
    to: to ?? undefined,
    cursor: cursor ?? undefined,
    limit,
  });

  return http.ok({
    items: result.items,
    pagination: {
      limit,
      cursor: cursor?.toISOString() ?? null,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    },
  });
});
